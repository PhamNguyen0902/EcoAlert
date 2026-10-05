import type { Alert, GeoLocation } from "../types";

export type IncidentGroup = "PENDING" | "PROCESSING" | "RESOLVED";
export type MyReportFilter = "ALL" | "PROCESSING" | "RESOLVED";
export type MapFilter = "ALL" | "NEARBY" | IncidentGroup;
export interface MapCoordinate {
  latitude: number;
  longitude: number;
}

export const INCIDENT_COLORS: Record<IncidentGroup, string> = {
  PENDING: "#F59E0B",
  PROCESSING: "#38BDF8",
  RESOLVED: "#22C55E",
};
export const NEARBY_RADIUS_METERS = 5000;

export const getIncidentGroup = (status?: string): IncidentGroup | null => {
  switch (status?.trim().toUpperCase()) {
    case "PENDING":
    case "AI_ANALYZING":
    case "VERIFIED":
      return "PENDING";
    case "ASSIGNED":
    case "IN_PROGRESS":
      return "PROCESSING";
    case "RESOLVED":
    case "CLOSED":
      return "RESOLVED";
    default:
      return null;
  }
};

/** GeoJSON is longitude first; never swap the stored data in-place. */
export const toMapCoordinate = (
  location?: GeoLocation | null,
): MapCoordinate | null => {
  if (!Array.isArray(location?.coordinates)) return null;
  const [longitude, latitude] = location?.coordinates ?? [];
  if (typeof latitude !== "number" || typeof longitude !== "number")
    return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
};

export const distanceMeters = (a: MapCoordinate, b: MapCoordinate): number => {
  const radians = (n: number) => (n * Math.PI) / 180;
  const lat = radians(b.latitude - a.latitude);
  const lng = radians(b.longitude - a.longitude);
  const h =
    Math.sin(lat / 2) ** 2 +
    Math.cos(radians(a.latitude)) *
      Math.cos(radians(b.latitude)) *
      Math.sin(lng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
};

export const matchesMyReportFilter = (
  alert: Pick<Alert, "status">,
  filter: MyReportFilter,
): boolean => {
  if (filter === "ALL") return true;
  const group = getIncidentGroup(alert.status);
  return filter === "RESOLVED"
    ? group === "RESOLVED"
    : group === "PENDING" || group === "PROCESSING";
};
