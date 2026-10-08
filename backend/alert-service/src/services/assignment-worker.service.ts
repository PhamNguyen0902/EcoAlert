import { randomUUID } from "crypto";
import { createLogger } from "@ecoalert/shared";
import { Alert } from "../models/alert.model";
import { officerAssignmentService } from "./officer-assignment.service";
import { assignmentDelivery } from "./assignment-delivery.service";
const logger = createLogger("assignment-worker");
export async function processAssignmentJobs() {
  const due = await Alert.find({
    "autoAssignmentJob.pending": true,
    "autoAssignmentJob.nextAttemptAt": { $lte: new Date() },
    isDeleted: false,
    $or: [
      { "autoAssignmentJob.leaseUntil": null },
      { "autoAssignmentJob.leaseUntil": { $lte: new Date() } },
    ],
  })
    .sort({ "autoAssignmentJob.nextAttemptAt": 1 })
    .limit(10)
    .select("_id")
    .lean();
  for (const row of due) {
    const owner = randomUUID();
    const claimed = await Alert.findOneAndUpdate(
      {
        _id: row._id,
        "autoAssignmentJob.pending": true,
        $or: [
          { "autoAssignmentJob.leaseUntil": null },
          { "autoAssignmentJob.leaseUntil": { $lte: new Date() } },
        ],
      },
      {
        $set: {
          "autoAssignmentJob.owner": owner,
          "autoAssignmentJob.leaseUntil": new Date(Date.now() + 120_000),
        },
      },
      { new: true },
    );
    if (!claimed?.autoAssignmentJob) continue;
    const job = claimed.autoAssignmentJob;
    try {
      const result = await officerAssignmentService.autoAssignOfficer(
        String(claimed._id),
        { id: job.actorId, role: "ADMIN", correlationId: job.correlationId },
        "ADMIN_VERIFICATION",
      );
      const retry =
        !result.assigned &&
        ["DEPENDENCY_UNAVAILABLE", "ASSIGNMENT_BUSY"].includes(result.reason) &&
        job.attempts < 4;
      await Alert.updateOne(
        { _id: row._id, "autoAssignmentJob.owner": owner },
        {
          $inc: { "autoAssignmentJob.attempts": 1 },
          $set: {
            "autoAssignmentJob.pending": retry,
            "autoAssignmentJob.nextAttemptAt": new Date(
              Date.now() + 30_000 * 2 ** job.attempts,
            ),
          },
          $unset: {
            "autoAssignmentJob.owner": 1,
            "autoAssignmentJob.leaseUntil": 1,
          },
        },
      );
    } catch (error) {
      logger.warn("Dispatch job failed; retained for retry", {
        alertId: String(row._id),
        errorType: error instanceof Error ? error.name : "Error",
      });
      await Alert.updateOne(
        { _id: row._id, "autoAssignmentJob.owner": owner },
        {
          $inc: { "autoAssignmentJob.attempts": 1 },
          $set: {
            "autoAssignmentJob.pending": job.attempts < 4,
            "autoAssignmentJob.nextAttemptAt": new Date(Date.now() + 60_000),
          },
          $unset: {
            "autoAssignmentJob.owner": 1,
            "autoAssignmentJob.leaseUntil": 1,
          },
        },
      );
    }
  }
  const events = await Alert.find({
    "assignmentEvent.eventId": { $exists: true },
    "assignmentEvent.deliveredAt": null,
    "assignmentEvent.nextAttemptAt": { $lte: new Date() },
    $or: [
      { "assignmentEvent.leaseUntil": null },
      { "assignmentEvent.leaseUntil": { $lte: new Date() } },
    ],
  })
    .sort({ "assignmentEvent.nextAttemptAt": 1, _id: 1 })
    .limit(20)
    .select("_id")
    .lean();
  for (const row of events) await assignmentDelivery.deliver(String(row._id));
}
export function startAssignmentWorker() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await processAssignmentJobs();
    } catch (error) {
      logger.warn("Assignment worker unavailable", {
        errorType: error instanceof Error ? error.name : "Error",
      });
    } finally {
      running = false;
    }
  };
  void tick();
  setInterval(() => void tick(), 10_000).unref();
}
