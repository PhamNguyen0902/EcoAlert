import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, ViewStyle } from "react-native";

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * Shimmering placeholder block. Skeletons communicate "content is loading
 * and roughly this shape" much faster than a spinner, and reduce perceived
 * load time since the layout doesn't jump when data arrives.
 */
export const Skeleton: React.FC<SkeletonProps> = ({ width = "100%", height = 16, borderRadius = 8, style }) => {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: "#E2E8F0", opacity }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
};

export const DashboardSkeleton: React.FC = () => (
  <View style={styles.container}>
    <View style={styles.row}>
      <Skeleton width={180} height={26} />
      <Skeleton width={40} height={40} borderRadius={20} />
    </View>
    <Skeleton height={110} borderRadius={24} style={{ marginBottom: 24 }} />
    <View style={[styles.row, { marginBottom: 12 }]}>
      <Skeleton width="48%" height={90} borderRadius={18} />
      <Skeleton width="48%" height={90} borderRadius={18} />
    </View>
    <View style={[styles.row, { marginBottom: 24 }]}>
      <Skeleton width="48%" height={90} borderRadius={18} />
      <Skeleton width="48%" height={90} borderRadius={18} />
    </View>
    <Skeleton height={180} borderRadius={18} style={{ marginBottom: 24 }} />
    <Skeleton height={120} borderRadius={18} style={{ marginBottom: 12 }} />
    <Skeleton height={120} borderRadius={18} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
