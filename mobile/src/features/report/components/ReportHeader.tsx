import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ArrowLeft, Bell, Leaf } from "lucide-react-native";
import { useReportTheme } from "../useReportTheme";

interface Props {
  onBack: () => void;
  avatarLabel?: string;
}
export const ReportHeader = ({ onBack, avatarLabel = "EA" }: Props) => {
  const { colors } = useReportTheme();
  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.divider,
        },
      ]}
    >
      <TouchableOpacity
        onPress={onBack}
        style={styles.touchButton}
        accessibilityRole="button"
        accessibilityLabel="Quay lại"
      >
        <ArrowLeft size={20} color={colors.textSecondary} />
      </TouchableOpacity>
      <View style={styles.brand}>
        <Leaf size={20} color={colors.primary} />
        <Text style={[styles.brandName, { color: colors.text }]}>Báo Cáo</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          disabled
          style={styles.touchButton}
          accessibilityRole="button"
          accessibilityLabel="Thông báo"
        >
          <Bell size={19} color={colors.textMuted} />
        </TouchableOpacity>
        <View style={[styles.avatar, { backgroundColor: colors.greenSoft }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {avatarLabel.slice(0, 2).toUpperCase()}
          </Text>
        </View>
      </View>
    </View>
  );
};
const styles = StyleSheet.create({
  header: {
    height: 58,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  touchButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  brandName: { fontSize: 15, fontWeight: "800" },
  actions: { flexDirection: "row", alignItems: "center", gap: 4 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 10, fontWeight: "800" },
});
