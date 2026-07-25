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
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../../utils/constants";

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: "primary" | "secondary" | "outline" | "destructive" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = "primary",
  size = "md",
  loading = false,
  style,
  textStyle,
  icon,
  disabled,
  ...props
}) => {
  const isPrimary = variant === "primary";
  const isDisabled = disabled || loading;

  const getContainerStyle = () => {
    switch (variant) {
      case "secondary":
        return [styles.container, styles.secondary, sizeStyles[size], style];
      case "outline":
        return [styles.container, styles.outline, sizeStyles[size], style];
      case "destructive":
        return [styles.container, styles.destructive, sizeStyles[size], style];
      case "ghost":
        return [styles.container, styles.ghost, sizeStyles[size], style];
      default:
        return [styles.container, sizeStyles[size], style];
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case "outline":
      case "ghost":
        return [styles.text, styles.textDark, textStyles[size], textStyle];
      default:
        return [styles.text, textStyles[size], textStyle];
    }
  };

  const renderContent = () => (
    <>
      {loading ? (
        <ActivityIndicator color={variant === "outline" || variant === "ghost" ? COLORS.primary : "#FFF"} style={styles.loader} />
      ) : icon ? (
        <>{icon}</>
      ) : null}
      <Text style={getTextStyle()}>{title}</Text>
    </>
  );

  if (isPrimary && !isDisabled) {
    return (
      <TouchableOpacity activeOpacity={0.85} disabled={isDisabled} style={[style, { borderRadius: 14 }]} {...props}>
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.container, sizeStyles[size]]}
        >
          {renderContent()}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      disabled={isDisabled}
      style={[getContainerStyle(), isDisabled && styles.disabled]}
      {...props}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

const sizeStyles = StyleSheet.create({
  sm: { paddingVertical: 8, paddingHorizontal: 16 },
  md: { paddingVertical: 14, paddingHorizontal: 20 },
  lg: { paddingVertical: 18, paddingHorizontal: 28 },
});

const textStyles = StyleSheet.create({
  sm: { fontSize: 13 },
  md: { fontSize: 15 },
  lg: { fontSize: 17 },
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  secondary: {
    backgroundColor: COLORS.secondary,
    shadowColor: COLORS.secondary,
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: COLORS.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  destructive: {
    backgroundColor: COLORS.destructive,
    shadowColor: COLORS.destructive,
  },
  ghost: {
    backgroundColor: "transparent",
    shadowOpacity: 0,
    elevation: 0,
  },
  text: {
    color: "#FFFFFF",
    fontWeight: "700",
    textAlign: "center",
  },
  textDark: {
    color: COLORS.text,
  },
  disabled: {
    opacity: 0.6,
  },
  loader: {
    marginRight: 8,
  },
});
