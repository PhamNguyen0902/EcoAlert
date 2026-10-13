import React, { memo } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import type { HeroMotion } from "./useHeroMotion";

// Bundled transparent artwork: no network dependency on Home.
export const ECO_CITY_ASSET = require("../../../../assets/hero/eco-city.png");

export const EcoCityIllustration = memo(function EcoCityIllustration({
  motion,
}: {
  motion: HeroMotion;
}) {
  const floating = useAnimatedStyle(() => ({
    transform: [{ translateY: -4 * motion.levitation.value }],
    opacity: 0.65 + 0.35 * motion.entrance.value,
  }));
  const shadow = useAnimatedStyle(() => ({
    opacity: 0.18 - 0.05 * motion.levitation.value,
  }));
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.scene}
    >
      <Animated.View style={[styles.shadow, shadow]} />
      <Animated.View style={[styles.art, floating]}>
        <Image
          source={ECO_CITY_ASSET}
          style={styles.image}
          resizeMode="contain"
          resizeMethod="resize"
          fadeDuration={0}
          accessible={false}
        />
      </Animated.View>
    </View>
  );
});
const styles = StyleSheet.create({
  scene: {
    width: "43%",
    maxWidth: 160,
    maxHeight: 140,
    aspectRatio: 1,
    flexShrink: 0,
  },
  art: { ...StyleSheet.absoluteFill },
  image: { width: "100%", height: "100%" },
  shadow: {
    position: "absolute",
    bottom: 5,
    left: "15%",
    right: "15%",
    height: "16%",
    borderRadius: 100,
    backgroundColor: "#051C28",
    transform: [{ scaleY: 0.45 }],
  },
});
