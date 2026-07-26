import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { STATUS_COLORS } from "../../utils/constants";

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
  const normStatus = label?.toUpperCase() || "PENDING";
  const statusColor = STATUS_COLORS[normStatus] || { bg: "#F1F5F9", text: "#475569" };

  const finalBg = type === "custom" ? bgColor || "#F1F5F9" : statusColor.bg;
  const finalText = type === "custom" ? textColor || "#475569" : statusColor.text;

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
