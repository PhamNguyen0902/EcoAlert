import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { STATUS_COLORS, DARK_STATUS_COLORS } from "../../utils/constants";
import { useTheme } from "../../context/ThemeContext";

interface BadgeProps {
  label: string;
  type?: "status" | "custom";
  bgColor?: string;
  textColor?: string;
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  type = "status",
  bgColor,
  textColor,
  style,
}) => {
  const { isDark } = useTheme();
  const normStatus = label?.toUpperCase() || "PENDING";
  const palette = isDark ? DARK_STATUS_COLORS : STATUS_COLORS;
  const statusColor = palette[normStatus] || { bg: isDark ? "rgba(148,163,184,0.2)" : "#F1F5F9", text: isDark ? "#CBD5E1" : "#475569" };

  const finalBg = type === "custom" ? bgColor || (isDark ? "rgba(148,163,184,0.2)" : "#F1F5F9") : statusColor.bg;
  const finalText = type === "custom" ? textColor || (isDark ? "#CBD5E1" : "#475569") : statusColor.text;

  return (
    <View style={[styles.badge, { backgroundColor: finalBg }, style]}>
      <Text style={[styles.badgeText, { color: finalText }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});

