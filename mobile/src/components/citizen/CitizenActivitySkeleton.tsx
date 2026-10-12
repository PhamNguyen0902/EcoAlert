import React from "react";
import { StyleSheet, View } from "react-native";
import { Card } from "../ui/Card";
import { useCivicTheme } from "../../theme/useCivicTheme";
import { civicRadius, civicSpace } from "../../theme/civicDesign";

/** Same thumbnail/copy geometry as compact CitizenReportCard; no extra animation. */
export function CitizenActivitySkeleton() {
  const { colors } = useCivicTheme();
  const fill = { backgroundColor: colors.borderStrong, opacity: 0.45 };
  return (
    <View
      accessible
      accessibilityLabel="Đang tải hoạt động gần đây"
      accessibilityState={{ busy: true }}
      style={styles.stack}
    >
      {[0, 1].map((key) => (
        <View
          key={key}
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Card appearance="civic" style={styles.row}>
            <View style={[styles.thumbnail, fill]} />
            <View style={styles.copy}>
              <View style={[styles.badge, fill]} />
              <View style={[styles.line, fill]} />
              <View style={[styles.line, styles.short, fill]} />
            </View>
          </Card>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: civicSpace.md },
  row: { flexDirection: "row", alignItems: "center", gap: civicSpace.md },
  thumbnail: { width: 72, height: 96, borderRadius: civicRadius.chip },
  copy: { flex: 1, minWidth: 0, gap: civicSpace.sm },
  badge: { width: "42%", height: 14, borderRadius: 4 },
  line: { width: "90%", height: 14, borderRadius: 4 },
  short: { width: "65%", height: 12 },
});
