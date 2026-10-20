import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import {
  navigationHeading,
  validMapFix,
  type MapFollowMode,
} from "../utils/officerMapCamera";

/** Foreground map-only subscriptions; never write route-origin or report GPS. */
export function useOfficerMapFollow(active: boolean) {
  const [mode, setMode] = useState<MapFollowMode>("off");
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const [position, setPosition] = useState<Location.LocationObject | null>(
    null,
  );
  const [heading, setHeading] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restart, setRestart] = useState(0);
  const pause = useCallback(() => {
    modeRef.current = "off";
    setMode("off");
  }, []);
  const start = useCallback((next: Exclude<MapFollowMode, "off">) => {
    modeRef.current = next;
    setError(null);
    setPosition(null);
    setHeading(null);
    setPending(true);
    setMode(next);
    setRestart((value) => value + 1);
  }, []);
  useEffect(() => {
    if (!active || mode === "off") {
      setPending(false);
      return;
    }
    let disposed = false;
    let location: Location.LocationSubscription | undefined;
    let direction: Location.LocationSubscription | undefined;
    let fix: Location.LocationObject | null = null;
    let compass: {
      value: Location.LocationHeadingObject;
      timestamp: number;
    } | null = null;
    setPending(true);
    const fail = () => {
      if (disposed) return;
      modeRef.current = "off";
      setError(
        "Chưa theo dõi được GPS. Kiểm tra quyền vị trí rồi thử lại; bạn vẫn có thể kéo và zoom bản đồ.",
      );
      setPending(false);
      setMode("off");
    };
    const timer = setTimeout(fail, 20000);
    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (disposed || modeRef.current !== mode) return;
        if (!permission.granted) {
          fail();
          return;
        }
        // Start independently: an unavailable compass must not block GPS following.
        if (mode === "heading") {
          void Location.watchHeadingAsync(
            (value) => {
              if (disposed || modeRef.current !== mode) return;
              compass = { value, timestamp: Date.now() };
              setHeading(navigationHeading(fix, compass));
            },
            () => {
              compass = null;
              if (!disposed) setHeading(navigationHeading(fix, null));
            },
          )
            .then((subscription) => {
              if (disposed) subscription.remove();
              else direction = subscription;
            })
            .catch(() => {
              if (!disposed) setHeading(navigationHeading(fix, null));
            });
        }
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            // iOS distance filtering can otherwise stop fixes at rest, making
            // compass-follow lose its fresh center. The camera gate filters jitter.
            distanceInterval: 0,
            timeInterval: 1000,
          },
          (next) => {
            if (disposed || modeRef.current !== mode || !validMapFix(next))
              return;
            fix = next;
            clearTimeout(timer);
            setPosition(next);
            setHeading(navigationHeading(fix, compass));
            setPending(false);
          },
          fail,
        );
        if (disposed) subscription.remove();
        else location = subscription;
      } catch {
        fail();
      }
    })();
    return () => {
      disposed = true;
      clearTimeout(timer);
      location?.remove();
      direction?.remove();
    };
  }, [active, mode, restart]);
  return { mode, position, heading, pending, error, start, pause };
}
