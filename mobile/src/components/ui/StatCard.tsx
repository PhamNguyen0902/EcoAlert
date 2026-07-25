import React, { useEffect } from "react";
import { View, Text, StyleSheet, StyleProp, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import { LucideIcon } from "lucide-react-native";
import { GlassCard } from "./GlassCard";
import { COLORS } from "../../utils/constants";

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  style?: StyleProp<ViewStyle>;
  delay?: number;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  iconColor = COLORS.primary,
  iconBgColor = COLORS.primaryLight,
  style,
  delay = 0,
}) => {
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(delay, withSpring(1, { damping: 15 }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
  }, [value, delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.wrapper, style, animatedStyle]}>
      <GlassCard
        style={styles.card}
        gradientColors={["rgba(255, 255, 255, 0.9)", "rgba(255, 255, 255, 0.7)"]}
      >
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: iconBgColor }]}>
            <Icon color={iconColor} size={22} />
          </View>
          <Text style={styles.value}>{value}</Text>
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </GlassCard>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    minWidth: 140,
  },
  card: {
    padding: 16,
    borderRadius: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textMuted,
    letterSpacing: 0.2,
  },
});
