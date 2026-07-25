import React from "react";
import { View, Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from "react-native";
import { STATUS_COLORS, SEVERITY_COLORS } from "../../utils/constants";

interface BadgeProps {
  label: string;
  type?: "status" | "severity" | "custom";
  colorKey?: string;
  bgColor?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  type = "status",
  colorKey,
  bgColor,
  textColor,
  style,
  textStyle,
}) => {
  const key = colorKey || label;

  let bg = bgColor || "#E2E8F0";
  let text = textColor || "#475569";
  let border = "transparent";

  if (type === "status" && STATUS_COLORS[key]) {
    bg = STATUS_COLORS[key].bg;
    text = STATUS_COLORS[key].text;
    border = STATUS_COLORS[key].border || "transparent";
  } else if (type === "severity" && SEVERITY_COLORS[key]) {
    bg = SEVERITY_COLORS[key].bg;
    text = SEVERITY_COLORS[key].text;
  }

  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: border }, style]}>
      <Text style={[styles.text, { color: text }, textStyle]}>{label.toUpperCase()}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
