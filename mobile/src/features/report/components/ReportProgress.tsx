import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useReportTheme } from "../useReportTheme";
const STEPS = ["VỊ TRÍ", "CHỤP ẢNH", "KIỂM TRA", "XÁC NHẬN"];
export const ReportProgress = ({ step }: { step: 1 | 2 | 3 | 4 }) => {
  const { colors } = useReportTheme();
  const progress = useRef(new Animated.Value((step - 1) * 25)).current;
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: step * 25,
      duration: 200,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, step]);
  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel={`Tiến trình báo cáo, bước ${step} trên 4`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: 4, now: step }}
    >
      <View style={styles.heading}>
        <Text style={[styles.technicalLabel, { color: colors.textMuted }]}>
          TIẾN TRÌNH BÁO CÁO
        </Text>
        <Text style={[styles.stepText, { color: colors.primary }]}>
          BƯỚC {step}/4
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.divider }]}>
        <Animated.View
          style={[
            styles.progress,
            {
              width: progress.interpolate({
                inputRange: [0, 100],
                outputRange: ["0%", "100%"],
              }),
              backgroundColor: colors.primary,
            },
          ]}
        />
      </View>
      <View style={styles.labels}>
        {STEPS.map((label, index) => (
          <Text
            key={label}
            style={[
              styles.label,
              {
                color:
                  index + 1 === step
                    ? colors.text
                    : index + 1 < step
                      ? colors.primary
                      : colors.subtle,
              },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
};
const styles = StyleSheet.create({
  container: { gap: 12 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  technicalLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  stepText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
  track: { height: 3, borderRadius: 2, overflow: "hidden" },
  progress: { height: "100%", borderRadius: 2 },
  labels: { flexDirection: "row", gap: 8 },
  label: { flex: 1, fontSize: 9, fontWeight: "700", letterSpacing: 0.4 },
});
