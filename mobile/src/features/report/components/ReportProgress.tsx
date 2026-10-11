import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { civicType, civicSpace, civicRadius } from "../../../theme/civicDesign";
import { useReportTheme } from "../useReportTheme";
import { useFieldReducedMotion } from "./stitch/FieldUI";
const STEPS = ["VỊ TRÍ", "CHỤP ẢNH", "KIỂM TRA", "XÁC NHẬN"];
export const ReportProgress = ({ step, status }: { step: 1 | 2 | 3 | 4; status?: string }) => {
  const { colors } = useReportTheme();
  const reduced = useFieldReducedMotion();
  const progress = useRef(new Animated.Value((step - 1) * 25)).current;
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: step * 25,
      duration: reduced ? 0 : 200,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, step, reduced]);
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
          {status || "TIẾN TRÌNH BÁO CÁO"}
        </Text>
        <Text style={[styles.stepText, { color: colors.primary }]}>
          BƯỚC 0{step} / 04
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
      <View style={styles.labels} accessibilityElementsHidden>
        {STEPS.map((label, index) => (
          <View
            key={label}
            style={[
              styles.label,
              {
                backgroundColor:
                  index + 1 === step
                    ? colors.primary
                    : index + 1 < step
                      ? colors.primary
                      : colors.subtle,
                opacity: index + 1 < step ? 0.6 : 1,
              },
            ]}
          >
          </View>
        ))}
      </View>
    </View>
  );
};
const styles = StyleSheet.create({
  container: { gap: 8 },
  heading: {
    flexDirection: "row",
    alignItems: "center", flexWrap: "wrap", gap: 4,
    justifyContent: "space-between",
  },
  technicalLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 0.6 },
  stepText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
  track: { height: 0, overflow: "hidden" },
  progress: { height: "100%", borderRadius: 2 },
  labels: { flexDirection: "row", gap: 4 },
  label: { flex: 1, height: 3, borderRadius: 2 },
});
