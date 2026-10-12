import { api } from "./client";
import { getGeoJsonMapCoordinates, type MapCoordinates } from "../utils/maps";
export interface OfficerRoute {
  distanceMeters: number;
  durationSeconds: number;
  points: MapCoordinates[];
}
export function parseOfficerRoute(data: unknown): OfficerRoute {
  if (!data || typeof data !== "object") throw new Error("Invalid route");
  const route = data as {
    distanceMeters?: unknown;
    durationSeconds?: unknown;
    geometry?: { type?: unknown; coordinates?: unknown };
  };
  if (
    typeof route.distanceMeters !== "number" ||
    !Number.isFinite(route.distanceMeters) ||
    route.distanceMeters < 0 ||
    typeof route.durationSeconds !== "number" ||
    !Number.isFinite(route.durationSeconds) ||
    route.durationSeconds < 0 ||
    route.geometry?.type !== "LineString" ||
    !Array.isArray(route.geometry.coordinates) ||
    route.geometry.coordinates.length < 2
  )
    throw new Error("Invalid route");
  const points = route.geometry.coordinates.map((point: unknown) =>
    Array.isArray(point) ? getGeoJsonMapCoordinates(point) : null,
  );
  if (points.some((point) => !point)) throw new Error("Invalid geometry");
  return {
    distanceMeters: route.distanceMeters,
    durationSeconds: route.durationSeconds,
    points: points as MapCoordinates[],
  };
}
export async function getOfficerRoute(
  start: MapCoordinates,
  end: MapCoordinates,
  signal?: AbortSignal,
) {
  const response = await api.get("/v1/gis/route", {
    params: {
      startLat: start.latitude,
      startLng: start.longitude,
      endLat: end.latitude,
      endLng: end.longitude,
    },
    signal,
    timeout: 15000,
  });
  return parseOfficerRoute(response.data?.data ?? response.data);
}
