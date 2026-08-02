import React from "react";
import { View, Text, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { GlassCard } from "./GlassCard";
import { COLORS } from "../../utils/constants";
import { useTheme } from "../../context/ThemeContext";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  iconColor?: string;
  iconBgColor?: string;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: IconComp,
  iconColor,
  iconBgColor,
  style,
}) => {
  const { colors, isDark } = useTheme();
  const effectiveIconColor = iconColor || colors.primary;
  const effectiveIconBgColor = iconBgColor || (isDark ? "rgba(34, 197, 94, 0.2)" : colors.primaryLight);

  return (
    <GlassCard style={[styles.card, style]}>
      <View style={styles.content}>
        <View style={[styles.iconBox, { backgroundColor: effectiveIconBgColor }]}>
          <IconComp size={22} color={effectiveIconColor} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
          <Text style={[styles.title, { color: colors.textMuted }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      </View>
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
  },
  value: {
    fontSize: 20,
    fontWeight: "800",
  },
  title: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
});

