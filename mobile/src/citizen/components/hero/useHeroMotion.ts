import { useEffect, useState } from "react";
import { AccessibilityInfo, AppState } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

/** One lifecycle for the whole hero; no React updates on animation frames. */
export function useHeroMotion() {
  const focused = useIsFocused();
  const systemReduced = useReducedMotion();
  const [reduced, setReduced] = useState(systemReduced);
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  const drift = useSharedValue(0);
  const levitation = useSharedValue(0);
  const entrance = useSharedValue(1);
  const enabled = focused && foreground && !reduced;

  useEffect(() => {
    const preference = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    const app = AppState.addEventListener("change", (state) =>
      setForeground(state === "active"),
    );
    return () => {
      preference.remove();
      app.remove();
    };
  }, []);

  useEffect(() => {
    const stop = () => {
      cancelAnimation(drift);
      cancelAnimation(levitation);
      cancelAnimation(entrance);
    };
    stop();
    drift.value = 0;
    levitation.value = 0;
    entrance.value = 1;
    if (enabled) {
      // Reverse repeats: 14s for terrain, 3.6s for the floating city.
      drift.value = withRepeat(
        withTiming(1, { duration: 7000, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
        undefined,
        ReduceMotion.System,
      );
      levitation.value = withRepeat(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
        undefined,
        ReduceMotion.System,
      );
      // Keep content readable/actionable even during the short entrance.
      entrance.value = 0;
      entrance.value = withTiming(1, {
        duration: 360,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      });
    }
    return stop;
  }, [enabled, drift, levitation, entrance]);

  return { enabled, drift, levitation, entrance };
}
export type HeroMotion = ReturnType<typeof useHeroMotion>;
