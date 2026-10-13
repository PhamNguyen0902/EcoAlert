import { format, isValid } from "date-fns";
import type { Alert } from "../../shared/types";

export const reportImage = (alert: Alert): string | undefined =>
  alert.fieldEvidence?.[0]?.displayUrl ||
  alert.fieldEvidence?.[0]?.originalUrl ||
  alert.mediaUrls?.[0];
export const reportTime = (value?: string): string =>
  value && isValid(new Date(value))
    ? format(new Date(value), "dd/MM/yyyy · HH:mm")
    : "Chưa có thời gian ghi nhận";
export const matchesReportSearch = (
  alert: Pick<Alert, "title" | "address" | "_id">,
  query: string,
): boolean => {
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d");
  return normalize(
    `${alert.title ?? ""} ${alert.address ?? ""} ${alert._id}`,
  ).includes(normalize(query.trim()));
};
/** UI milestones reflect workflow status, not invented arrival or completion times. */
export const reportProgress = (status: string): number => {
  switch (status.toUpperCase()) {
    case "VERIFIED":
      return 1;
    case "ASSIGNED":
    case "IN_PROGRESS":
      return 2;
    case "RESOLVED":
    case "CLOSED":
      return 3;
    default:
      return 0;
  }
};
