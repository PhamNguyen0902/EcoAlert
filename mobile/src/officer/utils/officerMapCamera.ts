import type { LocationObject, LocationHeadingObject } from "expo-location";
import type { Camera } from "react-native-maps";

export type MapFollowMode = "off" | "location" | "heading";
export function validHeading(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value < 360
  );
}
export function validMapFix(fix: LocationObject, now = Date.now()) {
  const c = fix.coords;
  return (
    Number.isFinite(fix.timestamp) &&
    now - fix.timestamp <= 30000 &&
    fix.timestamp - now <= 5000 &&
    Number.isFinite(c.latitude) &&
    Math.abs(c.latitude) <= 90 &&
    Number.isFinite(c.longitude) &&
    Math.abs(c.longitude) <= 180 &&
    c.accuracy !== null &&
    Number.isFinite(c.accuracy) &&
    c.accuracy >= 0 &&
    c.accuracy <= 100
  );
}
export function navigationHeading(
  fix: LocationObject | null,
  compass: { value: LocationHeadingObject; timestamp: number } | null,
  now = Date.now(),
): number | null {
  // Course is meaningful while moving; at rest prefer a calibrated compass.
  if (
    fix &&
    validMapFix(fix, now) &&
    now - fix.timestamp <= 15000 &&
    validHeading(fix.coords.heading) &&
    fix.coords.speed !== null &&
    Number.isFinite(fix.coords.speed) &&
    fix.coords.speed >= 1
  )
    return fix.coords.heading;
  if (
    compass &&
    now - compass.timestamp <= 10000 &&
    compass.value.accuracy >= 1
  ) {
    if (validHeading(compass.value.trueHeading))
      return compass.value.trueHeading;
    if (validHeading(compass.value.magHeading)) return compass.value.magHeading;
  }
  return null;
}
export const headingDelta = (from: number, to: number) =>
  ((to - from + 540) % 360) - 180;

/** Camera updates only, never route requests. Preserve native zoom/altitude/pitch. */
export class FollowCameraGate {
  private last: {
    latitude: number;
    longitude: number;
    heading?: number;
    at: number;
  } | null = null;
  reset() {
    this.last = null;
  }
  next(
    fix: LocationObject | null,
    heading: number | null,
    mode: MapFollowMode,
    now = Date.now(),
  ): Partial<Camera> | null {
    if (mode === "off" || !fix || !validMapFix(fix, now)) return null;
    const { latitude, longitude } = fix.coords;
    const previous = this.last;
    if (previous && now - previous.at < 1000) return null;
    const bearing =
      mode === "heading" && validHeading(heading) ? heading : undefined;
    if (previous) {
      const metres = Math.hypot(
        (latitude - previous.latitude) * 111320,
        (longitude - previous.longitude) *
          111320 *
          Math.cos((latitude * Math.PI) / 180),
      );
      const turn =
        bearing !== undefined &&
        (previous.heading === undefined ||
          Math.abs(headingDelta(previous.heading, bearing)) >= 5);
      if (metres < 3 && !turn) return null;
    }
    const smoothed =
      bearing === undefined
        ? undefined
        : previous?.heading === undefined
          ? bearing
          : (previous.heading +
              headingDelta(previous.heading, bearing) * 0.4 +
              360) %
            360;
    this.last = { latitude, longitude, heading: smoothed, at: now };
    return {
      center: { latitude, longitude },
      ...(smoothed === undefined ? {} : { heading: smoothed }),
    };
  }
}
