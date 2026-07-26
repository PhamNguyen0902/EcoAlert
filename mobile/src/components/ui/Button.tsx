import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacityProps,
  StyleProp,
  ViewStyle,
  TextStyle,
} from "react-native";
import { COLORS } from "../../utils/constants";

export interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  disabled,
  style,
  textStyle,
  ...props
}) => {
  const getVariantStyle = () => {
    switch (variant) {
      case "secondary":
        return styles.secondaryBg;
      case "outline":
        return styles.outlineBg;
      case "ghost":
        return styles.ghostBg;
      case "destructive":
        return styles.destructiveBg;
      default:
        return styles.primaryBg;
    }
  };

  const getVariantTextStyle = () => {
    switch (variant) {
      case "outline":
        return styles.outlineText;
      case "ghost":
        return styles.ghostText;
      default:
        return styles.defaultText;
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case "sm":
        return styles.smSize;
      case "lg":
        return styles.lgSize;
      default:
        return styles.mdSize;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled || loading}
      style={[
        styles.button,
        getVariantStyle(),
        getSizeStyle(),
        disabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "outline" || variant === "ghost" ? COLORS.primary : "#FFFFFF"}
        />
      ) : (
        <>
          {icon ? icon : null}
          <Text style={[styles.text, getVariantTextStyle(), textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  primaryBg: { backgroundColor: COLORS.primary },
  secondaryBg: { backgroundColor: COLORS.secondary },
  outlineBg: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: COLORS.border },
  ghostBg: { backgroundColor: "transparent" },
  destructiveBg: { backgroundColor: COLORS.destructive },
  disabled: { opacity: 0.5 },
  smSize: { height: 40, paddingHorizontal: 14 },
  mdSize: { height: 50, paddingHorizontal: 20 },
  lgSize: { height: 56, paddingHorizontal: 24 },
  text: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  defaultText: { color: "#FFFFFF" },
  outlineText: { color: COLORS.text },
  ghostText: { color: COLORS.primary },
});
