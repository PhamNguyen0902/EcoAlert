import type { Alert } from "../types";

export type OfficerTaskFilter = "ALL" | "NEW" | "ACTIVE" | "COMPLETED";
export const officerStatus = (alert: Pick<Alert, "status">) =>
  alert.status.toUpperCase();
// Preserve original categories; exclude explicitly non-waste legacy tasks from this workflow.
export const isWasteOfficerTask = (task: Pick<Alert, "category">) =>
  !task.category ||
  [
    "illegal_dumping",
    "illegal_construction_waste",
    "waste",
    "other",
    "unclassified",
  ].includes(task.category.toLowerCase());
export const filterOfficerTasks = (tasks: Alert[], filter: OfficerTaskFilter) =>
  tasks.filter((task) => {
    if (!isWasteOfficerTask(task)) return false;
    const status = officerStatus(task);
    if (filter === "NEW") return status === "ASSIGNED";
    if (filter === "ACTIVE") return status === "IN_PROGRESS";
    if (filter === "COMPLETED")
      return status === "RESOLVED" || status === "CLOSED";
    return ["ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"].includes(status);
  });
export const getOfficerTaskState = (
  task: Pick<Alert, "status" | "checkIn">,
) => {
  const status = officerStatus(task);
  if (status === "ASSIGNED")
    return { action: "START", label: "MỚI", color: "#F59E0B" } as const;
  if (status === "IN_PROGRESS")
    return task.checkIn?.verified
      ? ({
          action: "RESOLVE",
          label: "ĐÃ ĐẾN HIỆN TRƯỜNG",
          color: "#38BDF8",
        } as const)
      : ({ action: "ARRIVE", label: "ĐANG XỬ LÝ", color: "#38BDF8" } as const);
  if (status === "RESOLVED")
    return { action: "NONE", label: "ĐÃ XỬ LÝ", color: "#22C55E" } as const;
  if (status === "CLOSED")
    return { action: "NONE", label: "ĐÃ ĐÓNG", color: "#22C55E" } as const;
  return { action: "NONE", label: "KHÔNG KHẢ DỤNG", color: "#94A3B8" } as const;
};

export function officerErrorMessage(error: unknown, fallback: string): string {
  const response = (error as { response?: { data?: { message?: unknown } } })
    ?.response;
  const message = response?.data?.message;
  return typeof message === "string" && /[à-ỹđĐ]/i.test(message)
    ? message
    : fallback;
}
