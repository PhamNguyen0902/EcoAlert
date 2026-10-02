import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import {
  formatDetectionConfidence,
  getWasteDetectionLabel,
  groupDetectionsByClass,
} from "../../utils/visionBoundingBox";
import type { DetectionSummaryInput } from "../../utils/visionBoundingBox";

export function WasteDetectionResults({
  detections,
  showCount = true,
}: {
  detections: readonly DetectionSummaryInput[];
  showCount?: boolean;
}) {
  const { colors, isDark } = useTheme();
  const groups = useMemo(
    () => groupDetectionsByClass(detections),
    [detections],
  );
  return (
    <View style={styles.chips}>
      {groups.map((group) => {
        const label = getWasteDetectionLabel(group.materialClass);
        const confidence = formatDetectionConfidence(
          group.maxConfidence ?? undefined,
        );
        return (
          <View
            key={group.materialClass}
            style={[
              styles.chip,
              { backgroundColor: isDark ? "rgba(56,189,248,0.12)" : "#E0F2FE" },
            ]}
            accessible
            accessibilityLabel={`${label}, ${group.count} vùng${confidence ? `, độ tin cậy cao nhất ${confidence.replace("%", " phần trăm")}` : ""}`}
          >
            <Text style={[styles.text, { color: colors.text }]}>
              {label}
              {showCount ? ` · ${group.count} vùng` : ""}
              {confidence ? (
                <Text style={{ color: colors.secondary }}> · {confidence}</Text>
              ) : null}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    maxWidth: "100%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  text: { fontSize: 11, lineHeight: 16, fontWeight: "600" },
});
