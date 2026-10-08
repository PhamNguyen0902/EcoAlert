import {
  ForbiddenError,
  ConflictError,
  type AreaMatchResult,
} from "@ecoalert/shared";
import { alertRepository } from "../repositories/alert.repository";
import {
  officerShiftService,
  type OfficerAvailability,
} from "./officer-shift.service";
import { serviceAreaDirectory } from "./service-area-directory.service";
import { envConfig } from "../config/env.config";
import { alertService, type WorkflowActor } from "./alert.service";
import { isValidLongitude, isValidLatitude } from "../utils/geo-evidence.util";
import { withAssignmentLock } from "./assignment-lock.service";
export type AssignmentReason =
  | "AUTO_ASSIGNED"
  | "AREA_NOT_FOUND"
  | "NO_OFFICER_IN_AREA"
  | "NO_ACTIVE_SHIFT"
  | "CAPACITY_REACHED"
  | "NO_ELIGIBLE_OFFICER"
  | "ALREADY_ASSIGNED"
  | "NOT_VERIFIED"
  | "DEPENDENCY_UNAVAILABLE"
  | "INVALID_LOCATION"
  | "DISABLED"
  | "ASSIGNMENT_BUSY";
export interface AssignmentPreview {
  reason: AssignmentReason;
  match?: AreaMatchResult;
  candidates?: Array<
    OfficerAvailability & { eligible: boolean; exclusion?: string }
  >;
  selectedOfficerId?: string;
}
export const rankAreaOfficers = (
  match: AreaMatchResult,
  rows: OfficerAvailability[],
): AssignmentPreview => {
  if (!match.area) return { reason: "AREA_NOT_FOUND", match };
  if (!match.area.assignedOfficerIds.length)
    return { reason: "NO_OFFICER_IN_AREA", match, candidates: [] };
  const candidates = rows
    .filter((r) => match.area!.assignedOfficerIds.includes(r.officer._id))
    .map((r) => {
      const exclusion =
        r.officer.role !== "OFFICER" ||
        !r.officer.isActive ||
        r.officer.isDeleted
          ? "Tài khoản không đủ điều kiện"
          : envConfig.autoAssignRequireActiveShift &&
              r.shiftStatus !== "ON_SHIFT"
            ? "Ngoài ca trực"
            : r.activeTaskCount >= envConfig.autoAssignMaxActiveTasks
              ? "Đã đạt giới hạn nhiệm vụ"
              : undefined;
      return { ...r, eligible: !exclusion, exclusion };
    });
  // If history is incomplete for any eligible candidate, use ID for the whole tie group.
  // This avoids pretending a legacy missing timestamp means "never assigned".
  const reliableHistory = candidates
    .filter((c) => c.eligible)
    .every(
      (c) =>
        c.lastAssignedAt &&
        Number.isFinite(new Date(c.lastAssignedAt).getTime()),
    );
  candidates.sort(
    (a, b) =>
      Number(b.eligible) - Number(a.eligible) ||
      a.activeTaskCount - b.activeTaskCount ||
      (reliableHistory && a.eligible && b.eligible
        ? new Date(a.lastAssignedAt!).getTime() -
          new Date(b.lastAssignedAt!).getTime()
        : 0) ||
      a.officer._id.localeCompare(b.officer._id),
  );
  const selected = candidates.find((c) => c.eligible);
  const active = candidates.filter(
    (c) =>
      c.officer.role === "OFFICER" &&
      c.officer.isActive &&
      !c.officer.isDeleted,
  );
  const reason = selected
    ? "AUTO_ASSIGNED"
    : !active.length
      ? "NO_ELIGIBLE_OFFICER"
      : envConfig.autoAssignRequireActiveShift &&
          !active.some((c) => c.shiftStatus === "ON_SHIFT")
        ? "NO_ACTIVE_SHIFT"
        : "CAPACITY_REACHED";
  return {
    reason,
    match,
    candidates,
    selectedOfficerId: selected?.officer._id,
  };
};
export class OfficerAssignmentService {
  async preview(id: string, actor: WorkflowActor): Promise<AssignmentPreview> {
    if (actor.role.toUpperCase() !== "ADMIN")
      throw new ForbiddenError("Chỉ Admin được xem trước phân công");
    const alert = await alertService.getAlertById(id, actor);
    if (
      alert.assignedOfficerId ||
      ["assigned", "in_progress", "resolved", "closed"].includes(
        alert.status.toLowerCase(),
      )
    )
      return { reason: "ALREADY_ASSIGNED" };
    if (alert.status.toLowerCase() !== "verified")
      return { reason: "NOT_VERIFIED" };
    const [lng, lat] = alert.location?.coordinates || [];
    if (!isValidLongitude(lng) || !isValidLatitude(lat))
      return { reason: "INVALID_LOCATION" };
    try {
      const match = await serviceAreaDirectory.match(lng, lat);
      if (!match.area || !match.area.assignedOfficerIds.length)
        return rankAreaOfficers(match, []);
      return rankAreaOfficers(
        match,
        await officerShiftService.getAvailability(
          actor,
          match.area.assignedOfficerIds,
        ),
      );
    } catch {
      return { reason: "DEPENDENCY_UNAVAILABLE" };
    }
  }
  async autoAssignOfficer(
    id: string,
    actor: WorkflowActor,
    triggeredBy = "ADMIN_RETRY",
  ) {
    if (actor.role.toUpperCase() !== "ADMIN")
      throw new ForbiddenError("Chỉ Admin được phân công");
    await alertService.getAlertById(id, actor);
    if (!envConfig.autoAssignEnabled)
      return { assigned: false, alertId: id, reason: "DISABLED" as const };
    try {
      return await withAssignmentLock(async (assertOwned) => {
        const preview = await this.preview(id, actor);
        if (
          preview.reason !== "AUTO_ASSIGNED" ||
          !preview.match?.area ||
          !preview.selectedOfficerId
        ) {
          if (!["ALREADY_ASSIGNED", "NOT_VERIFIED"].includes(preview.reason))
            await alertRepository.findOneAndUpdate(
              { _id: id, status: /^verified$/i, assignedOfficerId: null },
              {
                $set: {
                  lastAssignmentAttempt: {
                    reason: preview.reason,
                    attemptedAt: new Date(),
                    triggeredBy,
                  },
                },
              },
            );
          return { assigned: false, alertId: id, reason: preview.reason };
        }
        // Recheck the current geometry/roster as well as workload before committing.
        const current = await alertService.getAlertById(id, actor);
        const [lng, lat] = current.location.coordinates;
        const freshMatch = await serviceAreaDirectory.match(lng, lat);
        const fresh = rankAreaOfficers(
          freshMatch,
          freshMatch.area?.assignedOfficerIds.length
            ? await officerShiftService.getAvailability(
                actor,
                freshMatch.area.assignedOfficerIds,
              )
            : [],
        );
        if (!fresh.selectedOfficerId || !freshMatch.area) {
          await alertRepository.findOneAndUpdate(
            { _id: id, status: /^verified$/i, assignedOfficerId: null },
            {
              $set: {
                lastAssignmentAttempt: {
                  reason: fresh.reason,
                  attemptedAt: new Date(),
                  triggeredBy,
                },
              },
            },
          );
          return { assigned: false, alertId: id, reason: fresh.reason };
        }
        await assertOwned();
        const selected = fresh.candidates!.find(
          (c) => c.officer._id === fresh.selectedOfficerId,
        )!;
        const alert = await alertService.commitOfficerAssignment(
          id,
          actor,
          selected.officer,
          {
            method: "AUTO",
            areaId: freshMatch.area._id,
            areaCode: freshMatch.area.code,
            areaName: freshMatch.area.name,
            reason:
              "Ít nhiệm vụ đang hoạt động nhất trong khu vực và đủ điều kiện ca trực",
            activeTaskCountAtSelection: selected.activeTaskCount,
            triggeredBy,
            expectedCoordinates: current.location.coordinates,
          },
        );
        return {
          assigned: true,
          alertId: id,
          officerId: fresh.selectedOfficerId,
          areaId: freshMatch.area._id,
          reason: "AUTO_ASSIGNED" as const,
          alert,
        };
      });
    } catch (error) {
      if (error instanceof ConflictError) {
        const alert = await alertRepository.findById(id);
        return {
          assigned: false,
          alertId: id,
          reason: alert?.assignedOfficerId
            ? ("ALREADY_ASSIGNED" as const)
            : ("ASSIGNMENT_BUSY" as const),
        };
      }
      await alertRepository.findOneAndUpdate(
        { _id: id, status: /^verified$/i, assignedOfficerId: null },
        {
          $set: {
            lastAssignmentAttempt: {
              reason: "DEPENDENCY_UNAVAILABLE",
              attemptedAt: new Date(),
              triggeredBy,
            },
          },
        },
      );
      return {
        assigned: false,
        alertId: id,
        reason: "DEPENDENCY_UNAVAILABLE" as const,
      };
    }
  }
}
export const officerAssignmentService = new OfficerAssignmentService();
