import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../context/ThemeContext";

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  gradientColors?: [string, string, ...string[]];
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  gradientColors,
}) => {
  const { colors, isDark } = useTheme();

  const defaultColors: [string, string] = isDark
    ? ["rgba(30, 41, 59, 0.95)", "rgba(15, 23, 42, 0.85)"]
    : ["rgba(255, 255, 255, 0.95)", "rgba(255, 255, 255, 0.85)"];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.glassBorder,
        },
        style,
      ]}
    >
      <LinearGradient colors={gradientColors || defaultColors} style={styles.gradient}>
        {children}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  gradient: {
    padding: 20,
    width: "100%",
  },
});
