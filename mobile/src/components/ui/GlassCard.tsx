import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../../utils/constants";

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  gradientColors?: [string, string, ...string[]];
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  gradientColors = ["rgba(255, 255, 255, 0.95)", "rgba(255, 255, 255, 0.85)"],
}) => {
  return (
    <View style={[styles.container, style]}>
      <LinearGradient colors={gradientColors} style={styles.gradient}>
        {children}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.8)",
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
