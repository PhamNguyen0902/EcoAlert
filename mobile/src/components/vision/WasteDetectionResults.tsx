import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useCivicTheme } from "../../theme/useCivicTheme";
import {
  civicType,
  civicSpace as space,
  civicRadius as radius,
} from "../../theme/civicDesign";
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
  const { colors } = useCivicTheme();
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
                width: width >= 280 ? (width - space.md) / 2 : "100%",
                backgroundColor: colors.soft,
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
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  chip: {
    maxWidth: "100%",
    padding: space.md,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: space.sm,
  },
  text: civicType.cardTitle,
  metadata: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  count: civicType.meta,
  confidence: { ...civicType.meta, fontWeight: "700" },
});
