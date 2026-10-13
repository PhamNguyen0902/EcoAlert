import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import type { Alert } from "../types";

export interface DashboardLocation {
  latitude: number;
  longitude: number;
  label: string;
  source: "device" | "report" | "default";
}

const DEFAULT_LOCATION: DashboardLocation = {
  latitude: 10.8231,
  longitude: 106.6297,
  label: "TP. Hồ Chí Minh",
  source: "default",
};

const getAlreadyAuthorizedLocation = async (): Promise<DashboardLocation | null> => {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== "granted") return null;

    const lastKnown = await Location.getLastKnownPositionAsync();
    if (!lastKnown) return null;

    return {
      latitude: lastKnown.coords.latitude,
      longitude: lastKnown.coords.longitude,
      label: "Vị trí hiện tại",
      source: "device",
    };
  } catch {
    return null;
  }
};

const locationFromReport = (alert?: Alert): DashboardLocation | null => {
  const [longitude, latitude] = alert?.location?.coordinates ?? [];
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    latitude,
    longitude,
    label: alert?.address?.trim() || "Vị trí báo cáo gần đây",
    source: "report",
  };
};

export const useDashboardLocation = (recentAlert?: Alert) => {
  const deviceLocation = useQuery({
    queryKey: ["dashboard-device-location"],
    queryFn: getAlreadyAuthorizedLocation,
    staleTime: 30 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: false,
    refetchOnMount: false,
  });

  const location = useMemo(
    () => deviceLocation.data ?? locationFromReport(recentAlert) ?? DEFAULT_LOCATION,
    [deviceLocation.data, recentAlert],
  );

  return {
    location,
    isResolvingDeviceLocation: deviceLocation.isLoading,
  };
};
