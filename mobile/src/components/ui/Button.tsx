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
import {
  civicStyles,
  civicType,
  getCivicColors,
} from "../../theme/civicDesign";
import { COLORS } from "../../utils/constants";
import { useTheme } from "../../context/ThemeContext";

export interface ButtonProps extends TouchableOpacityProps {
  title: string;
  appearance?: "default" | "civic";
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  appearance = "default",
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  disabled,
  style,
  textStyle,
  ...props
}) => {
  const theme = useTheme();
  const colors =
    appearance === "civic"
      ? getCivicColors(theme.colors, theme.isDark)
      : theme.colors;
  const civicButtonColor =
    variant === "primary"
      ? colors.primary
      : variant === "destructive"
        ? "#B91C1C"
        : colors.surface;
  const civicTextColor =
    variant === "primary"
      ? "#07101F"
      : variant === "destructive"
        ? "#FFFFFF"
        : colors.text;

  const getVariantStyle = () => {
    switch (variant) {
      case "secondary":
        return { backgroundColor: colors.surface };
      case "outline":
        return {
          backgroundColor: "transparent",
          borderWidth: 1.5,
          borderColor: colors.border,
        };
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
        return { color: colors.text };
      case "ghost":
        return { color: colors.primary };
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
        appearance === "civic" && {
          ...civicStyles.primaryButton,
          height: variant === "primary" ? 52 : 48,
          minHeight: variant === "primary" ? 52 : 48,
          backgroundColor:
            variant === "outline" || variant === "ghost"
              ? "transparent"
              : civicButtonColor,
          borderWidth: variant === "outline" ? 1 : 0,
        },
        disabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            appearance === "civic"
              ? civicTextColor
              : variant === "outline" || variant === "ghost"
                ? colors.primary
                : "#FFFFFF"
          }
        />
      ) : (
        <>
          {icon ? icon : null}
          <Text
            style={[
              styles.text,
              getVariantTextStyle(),
              appearance === "civic" && [
                civicType.button,
                { color: civicTextColor },
              ],
              textStyle,
            ]}
          >
            {title}
          </Text>
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
  ghostBg: { backgroundColor: "transparent" },
  destructiveBg: { backgroundColor: COLORS.destructive },
  disabled: { opacity: 0.5 },
  smSize: { height: 40, paddingHorizontal: 14 },
  mdSize: { height: 50, paddingHorizontal: 20 },
  lgSize: { height: 56, paddingHorizontal: 24 },
  text: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  defaultText: { color: "#FFFFFF" },
});
