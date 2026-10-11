import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fieldColors as c } from "./stitch/fieldDesign";

export const ReportProgress = ({
  step,
  status,
}: {
  step: 1 | 2 | 3 | 4;
  status?: string;
}) => (
  <View
    style={styles.container}
    accessible
    accessibilityRole="progressbar"
    accessibilityLabel={`Tiến trình báo cáo, bước ${step} trên 4`}
    accessibilityValue={{ min: 1, max: 4, now: step }}
  >
    <View style={styles.heading}>
      <Text style={styles.label}>{status || "TIẾN TRÌNH BÁO CÁO"}</Text>
      <Text style={styles.step}>BƯỚC 0{step} / 04</Text>
    </View>
    <View style={styles.track}>
      {[1, 2, 3, 4].map((value) => (
        <View
          key={value}
          style={[
            styles.segment,
            {
              backgroundColor: value <= step ? c.primary : "#233449",
              opacity: value < step ? 0.65 : 1,
            },
          ]}
        />
      ))}
    </View>
  </View>
);
const styles = StyleSheet.create({
  container: { gap: 8 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 4,
  },
  label: {
    color: c.cyan,
    fontSize: 9,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  step: {
    color: c.primary,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  track: { flexDirection: "row", gap: 4 },
  segment: { flex: 1, height: 3, borderRadius: 2 },
});
