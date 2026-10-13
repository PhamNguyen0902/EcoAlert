import React from "react";
import { View, StyleSheet } from "react-native";
import { useTheme } from "../../context/ThemeContext";

export const DashboardSkeleton: React.FC = () => {
  const { colors } = useTheme();
  const boxStyle = { backgroundColor: colors.border, opacity: 0.5 };

  return (
    <View style={styles.container}>
      <View style={[styles.headerBox, boxStyle]} />
      <View style={[styles.bannerBox, boxStyle]} />
      <View style={[styles.titleBox, boxStyle]} />
      <View style={styles.gridRow}>
        <View style={[styles.cardBox, boxStyle]} />
        <View style={[styles.cardBox, boxStyle]} />
      </View>
      <View style={styles.gridRow}>
        <View style={[styles.cardBox, boxStyle]} />
        <View style={[styles.cardBox, boxStyle]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  headerBox: { height: 48, borderRadius: 12 },
  bannerBox: { height: 100, borderRadius: 20 },
  titleBox: { height: 24, width: 150, borderRadius: 6 },
  gridRow: { flexDirection: "row", gap: 12 },
  cardBox: { flex: 1, height: 90, borderRadius: 16 },
});

