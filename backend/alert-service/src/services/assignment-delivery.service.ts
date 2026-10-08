import { randomUUID } from "crypto";
import { EVENTS, createLogger } from "@ecoalert/shared";
import { Alert } from "../models/alert.model";
import { rabbitMQService } from "./rabbitmq.service";
const logger = createLogger("assignment-delivery");
export const assignmentDelivery = {
  async deliver(id: string) {
    const owner = randomUUID();
    const alert = await Alert.findOneAndUpdate(
      {
        _id: id,
        "assignmentEvent.eventId": { $exists: true },
        "assignmentEvent.deliveredAt": null,
        "assignmentEvent.nextAttemptAt": { $lte: new Date() },
        $or: [
          { "assignmentEvent.leaseUntil": null },
          { "assignmentEvent.leaseUntil": { $lte: new Date() } },
        ],
      },
      {
        $set: {
          "assignmentEvent.owner": owner,
          "assignmentEvent.leaseUntil": new Date(Date.now() + 30_000),
        },
      },
      { new: true },
    );
    if (!alert?.assignmentEvent) return;
    const pending = alert.assignmentEvent;
    try {
      await rabbitMQService.publishEvent(
        EVENTS.OFFICER_ASSIGNED,
        pending.payload,
        pending.correlationId,
        pending.eventId,
      );
      await rabbitMQService.publishEvent(
        EVENTS.ALERT_UPDATED,
        { ...alert.toObject(), workflowNotificationHandled: true },
        pending.correlationId,
        `${pending.eventId}:updated`,
      );
      await Alert.updateOne(
        { _id: id, "assignmentEvent.owner": owner },
        {
          $set: { "assignmentEvent.deliveredAt": new Date() },
          $unset: {
            "assignmentEvent.leaseUntil": 1,
            "assignmentEvent.owner": 1,
          },
        },
      );
    } catch (error) {
      // At-least-once delivery: stable eventId reuses existing recipient/event deduplication.
      // Never roll back an assignment because the broker is unavailable.
      await Alert.updateOne(
        { _id: id, "assignmentEvent.owner": owner },
        {
          $inc: { "assignmentEvent.attempts": 1 },
          $set: {
            "assignmentEvent.nextAttemptAt": new Date(
              Date.now() +
                Math.min(300_000, 5000 * 2 ** Math.min(pending.attempts, 6)),
            ),
            "assignmentEvent.lastError":
              error instanceof Error ? error.name : "PublishError",
          },
          $unset: {
            "assignmentEvent.leaseUntil": 1,
            "assignmentEvent.owner": 1,
          },
        },
      );
      logger.warn("Assignment saved; notification delivery is pending", {
        alertId: id,
        eventId: pending.eventId,
      });
    }
  },
};
