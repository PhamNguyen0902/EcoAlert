import type {
  FieldReportCaptureDraft,
  FieldReportLocationDraft,
} from "../../types";
import { MAX_FIELD_GPS_ACCURACY_METERS } from "../../types";

export const FIELD_LOCATION_MAX_AGE_MS = 5 * 60_000;
export function fieldLocationReady(
  location: FieldReportLocationDraft | undefined,
  now: number,
) {
  if (!location || location.source !== "DEVICE_GPS") return false;
  const age = now - Date.parse(location.capturedAt);
  return (
    Number.isFinite(location.latitude) &&
    Math.abs(location.latitude) <= 90 &&
    Number.isFinite(location.longitude) &&
    Math.abs(location.longitude) <= 180 &&
    Number.isFinite(location.accuracyMeters) &&
    location.accuracyMeters >= 0 &&
    location.accuracyMeters <= MAX_FIELD_GPS_ACCURACY_METERS &&
    Number.isFinite(age) &&
    age >= 0 &&
    age <= FIELD_LOCATION_MAX_AGE_MS
  );
}

export function fieldIntegrity(
  capture?: FieldReportCaptureDraft,
  location?: FieldReportLocationDraft,
) {
  const time = capture ? Date.parse(capture.capturedAt) : NaN;
  return {
    camera: Boolean(capture?.originalLocalUri),
    gps: fieldLocationReady(location, time),
    time: Number.isFinite(time),
  };
}

/** API confidence is a unit interval; absent/malformed numbers are not promoted to certainty. */
export function fieldConfidence(value: unknown) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
    ? value
    : null;
}

export function readableFieldAddress(address?: string) {
  if (
    !address?.trim() ||
    /^(?:Location at\s*)?-?\d+\.\d+\s*,\s*-?\d+\.\d+$/i.test(address.trim())
  )
    return "Đã ghi nhận vị trí GPS";
  return address.trim();
}
