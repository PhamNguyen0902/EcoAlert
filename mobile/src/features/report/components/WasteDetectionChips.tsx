import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { WasteDetectionDraft } from "../types";
import { useReportTheme } from "../useReportTheme";

const MATERIAL_LABELS: Record<string, string> = {
  plastic_bag: "Túi nhựa",
  plastic_bottle: "Chai nhựa",
  glass_bottle: "Chai thủy tinh",
  cardboard: "Bìa carton",
  paper: "Giấy",
  metal: "Kim loại",
  organic_waste: "Rác hữu cơ",
  construction_waste: "Phế thải xây dựng",
  styrofoam: "Xốp",
  household_waste: "Rác sinh hoạt",
};

/** Groups actual detections for display; no changes to draft data or submitted results. */
export const WasteDetectionChips = ({
  detections,
  showCount = false,
}: {
  detections: WasteDetectionDraft[];
  showCount?: boolean;
}) => {
  const { colors } = useReportTheme();
  const groups = useMemo(() => {
    const result = new Map<
      string,
      { count: number; total: number; samples: number }
    >();
    detections.forEach((item) => {
      const group = result.get(item.label) ?? {
        count: 0,
        total: 0,
        samples: 0,
      };
      result.set(item.label, {
        count: group.count + (item.count ?? 1),
        total: group.total + (item.confidence ?? 0),
        samples: group.samples + Number(item.confidence !== undefined),
      });
    });
    return [...result.entries()];
  }, [detections]);
  return (
    <View style={styles.chips}>
      {groups.map(([label, group]) => (
        <View
          key={label}
          style={[styles.chip, { backgroundColor: colors.cyanSoft }]}
        >
          <Text style={[styles.text, { color: colors.textSecondary }]}>
            {showCount && group.count > 1 ? `${group.count} × ` : ""}
            {MATERIAL_LABELS[label] ?? label.replace(/_/g, " ")}
            {group.samples ? (
              <Text style={{ color: colors.secondary }}>
                {" "}
                · {Math.round((group.total / group.samples) * 100)}%
              </Text>
            ) : null}
          </Text>
        </View>
      ))}
    </View>
  );
};
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
