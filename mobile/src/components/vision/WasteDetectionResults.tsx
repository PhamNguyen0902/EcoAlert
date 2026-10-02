import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import {
  formatDetectionConfidence,
  getDetectionConfidenceColor,
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
  const [width, setWidth] = useState(0);
  const groups = useMemo(
    () => groupDetectionsByClass(detections),
    [detections],
  );
  return (
    <View
      style={styles.chips}
      onLayout={({ nativeEvent: { layout } }) => setWidth(layout.width)}
    >
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
              {
                width: width >= 358 ? (width - 8) / 2 : "100%",
                backgroundColor: isDark ? "#0D1A2B" : "#F1F5F9",
                borderColor: colors.border,
              },
            ]}
            accessible
            accessibilityLabel={`${label}, ${group.count} vùng${confidence ? `, độ tin cậy cao nhất ${confidence.replace("%", " phần trăm")}` : ""}`}
          >
            <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
            <View style={styles.metadata}>
              {showCount ? (
                <Text style={[styles.count, { color: colors.textMuted }]}>
                  {group.count} vùng
                </Text>
              ) : null}
              {confidence ? (
                <Text
                  style={[
                    styles.confidence,
                    { color: getDetectionConfidenceColor(group.maxConfidence) },
                  ]}
                >
                  {confidence}
                </Text>
              ) : null}
            </View>
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
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  text: { fontSize: 12, lineHeight: 17, fontWeight: "600" },
  metadata: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  count: { fontSize: 11, lineHeight: 16 },
  confidence: { fontSize: 11, lineHeight: 16, fontWeight: "700" },
});
