import React, { useEffect, useRef } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";
import { useForegroundScreen } from "../../hooks/useForegroundScreen";
import { useFieldReducedMotion } from "../../features/report/components/stitch/FieldUI";
/** Brief native opacity/scale transition, never a continuous map/camera loop. */
export function OfficerEntrance({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useFieldReducedMotion();
  const active = useForegroundScreen();
  const progress = useRef(new Animated.Value(1)).current;
  const entered = useRef(false);
  useEffect(() => {
    if (!active || reduced || entered.current) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 240,
      delay: Math.min(180, Math.max(0, delay)),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) entered.current = true;
    });
    return () => animation.stop();
  }, [active, reduced, delay, progress]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.985, 1],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
