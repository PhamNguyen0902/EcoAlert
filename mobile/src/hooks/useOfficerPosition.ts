import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";
import type { ShiftLocationInput } from "../shared/types/index";
import { acquireOfficerGps } from "../utils/officerResolution";
import { useForegroundScreen } from "./useForegroundScreen";
export type OfficerPosition = ShiftLocationInput & { recordedAt: string };
/** Explicit foreground request only. Never substitutes last-known/default coordinates. */
export function useOfficerPosition() {
  const [position, setPosition] = useState<OfficerPosition | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const alive = useRef(true);
  const active = useForegroundScreen();
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const refresh = async () => {
    if (busy.current || !activeRef.current) return null;
    busy.current = true;
    setPending(true);
    setError(null);
    setPosition(null);
    try {
      let recordedAt = "";
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const captureGps = acquireOfficerGps({
        permission: async () =>
          (await Location.requestForegroundPermissionsAsync()).granted,
        position: async () => {
          if (
            !alive.current ||
            !activeRef.current ||
            AppState.currentState !== "active"
          )
            throw new Error("INACTIVE");
          const fix = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Highest,
          });
          if (
            !Number.isFinite(fix.timestamp) ||
            Math.abs(Date.now() - fix.timestamp) > 60_000
          )
            throw new Error("STALE");
          recordedAt = new Date(fix.timestamp).toISOString();
          return {
            latitude: fix.coords.latitude,
            longitude: fix.coords.longitude,
            accuracyMeters: fix.coords.accuracy,
          };
        },
      });
      let gps: ShiftLocationInput;
      try {
        gps = await Promise.race([
          captureGps,
          new Promise<never>((_, reject) => {
            timeout = setTimeout(
              () => reject(new Error("GPS_TIMEOUT")),
              20_000,
            );
          }),
        ]);
      } finally {
        if (timeout) clearTimeout(timeout);
      }
      if (
        !alive.current ||
        !activeRef.current ||
        AppState.currentState !== "active"
      )
        return null;
      const next = { ...gps, recordedAt };
      setPosition(next);
      return next;
    } catch (failure) {
      if (alive.current)
        setError(
          failure instanceof Error &&
            failure.message.startsWith("Cần quyền GPS")
            ? "Chưa cấp quyền vị trí. Mở cài đặt để cho phép GPS khi dùng ứng dụng."
            : "Chưa lấy được GPS mới. Kiểm tra quyền vị trí, ra nơi thoáng rồi thử lại.",
        );
      return null;
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  };
  return { position, pending, error, refresh };
}
