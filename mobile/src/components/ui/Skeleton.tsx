import React from "react";
import { View, StyleSheet } from "react-native";
import { COLORS } from "../../utils/constants";

export const DashboardSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.headerBox} />
      <View style={styles.bannerBox} />
      <View style={styles.titleBox} />
      <View style={styles.gridRow}>
        <View style={styles.cardBox} />
        <View style={styles.cardBox} />
      </View>
      <View style={styles.gridRow}>
        <View style={styles.cardBox} />
        <View style={styles.cardBox} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  headerBox: { height: 48, borderRadius: 12, backgroundColor: COLORS.border, opacity: 0.5 },
  bannerBox: { height: 100, borderRadius: 20, backgroundColor: COLORS.border, opacity: 0.5 },
  titleBox: { height: 24, width: 150, borderRadius: 6, backgroundColor: COLORS.border, opacity: 0.5 },
  gridRow: { flexDirection: "row", gap: 12 },
  cardBox: { flex: 1, height: 90, borderRadius: 16, backgroundColor: COLORS.border, opacity: 0.5 },
});
