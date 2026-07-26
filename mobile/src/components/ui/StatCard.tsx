import React from "react";
import { View, Text, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { GlassCard } from "./GlassCard";
import { COLORS } from "../../utils/constants";

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
  iconColor = COLORS.primary,
  iconBgColor = COLORS.primaryLight,
  style,
}) => {
  return (
    <GlassCard style={[styles.card, style]}>
      <View style={styles.content}>
        <View style={[styles.iconBox, { backgroundColor: iconBgColor }]}>
          <IconComp size={22} color={iconColor} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.value}>{value}</Text>
          <Text style={styles.title} numberOfLines={1}>
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
    color: COLORS.text,
  },
  title: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
