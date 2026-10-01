import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../../context/ThemeContext";

const STEPS = ["Vị trí GPS", "Chụp ảnh", "Kiểm tra", "Xác nhận"];

export const ReportProgress = ({ step }: { step: 1 | 2 | 3 | 4 }) => {
  const { colors } = useTheme();
  return <View style={styles.container} accessible accessibilityLabel={`Tiến trình xác minh, bước ${step} trên 4`} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: 4, now: step }}>
    <View style={styles.heading}><Text style={[styles.technicalLabel, { color: colors.textMuted }]}>TIẾN TRÌNH XÁC MINH</Text><Text style={[styles.stepText, { color: colors.primary }]}>BƯỚC {step}/4</Text></View>
    <View style={[styles.track, { backgroundColor: colors.border }]}><View style={[styles.progress, { width: `${step * 25}%`, backgroundColor: colors.primary }]} /></View>
    <View style={styles.labels}>{STEPS.map((label, index) => { const number = index + 1; const active = number <= step; return <View key={label} style={styles.labelItem}><View style={[styles.dot, { backgroundColor: active ? colors.primary : colors.border }]} /><Text style={[styles.label, { color: active ? colors.text : colors.textMuted }]} numberOfLines={1}>{label}</Text></View>; })}</View>
  </View>;
};

const styles = StyleSheet.create({ container: { gap: 9 }, heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, technicalLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 1.15 }, stepText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }, track: { height: 3, borderRadius: 2, overflow: "hidden" }, progress: { height: "100%", borderRadius: 2 }, labels: { flexDirection: "row", justifyContent: "space-between", gap: 4 }, labelItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4 }, dot: { width: 6, height: 6, borderRadius: 3 }, label: { flex: 1, fontSize: 9, fontWeight: "700" } });
