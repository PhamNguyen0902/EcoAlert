import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Leaf } from "lucide-react-native";
import type { User } from "../../../types";
import { useCivicTheme } from "../../../theme/useCivicTheme";
import { AnimatedTopographicBackground } from "./AnimatedTopographicBackground";
import { EcoCityIllustration } from "./EcoCityIllustration";
import { HeroActionButtons } from "./HeroActionButtons";
import { heroPalette, heroStyles as styles } from "./heroStyles";
import { useHeroMotion } from "./useHeroMotion";

interface Props {
  user?: User | null;
  onReport: () => void;
  onTrack: () => void;
}
export const HomeHero = memo(function HomeHero({
  user,
  onReport,
  onTrack,
}: Props) {
  const { isDark } = useCivicTheme();
  const palette = heroPalette(isDark);
  const motion = useHeroMotion();
  const entrance = useAnimatedStyle(() => ({
    opacity: 0.85 + 0.15 * motion.entrance.value,
    transform: [{ translateY: 5 * (1 - motion.entrance.value) }],
  }));
  const name = user?.fullName?.trim() || "Khách EcoAlert";
  return (
    <Animated.View style={[styles.shell, entrance]}>
      <LinearGradient
        colors={palette.gradient}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[
          styles.card,
          { backgroundColor: palette.background, borderColor: palette.border },
        ]}
      >
        <AnimatedTopographicBackground motion={motion} dark={isDark} />
        <LinearGradient
          pointerEvents="none"
          accessible={false}
          colors={palette.mask}
          locations={[0, 0.42, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.content}>
          <View style={styles.brandRow}>
            <Leaf size={18} color={palette.green} strokeWidth={2} />
            <Text style={[styles.brand, { color: palette.green }]}>
              EcoAlert
            </Text>
            <Text style={[styles.brandCaption, { color: palette.muted }]}>
              Ghi nhận để thay đổi
            </Text>
          </View>
          <View style={styles.main}>
            <View style={styles.copy}>
              <Text style={[styles.greeting, { color: palette.secondary }]}>
                {user ? "Xin chào!" : "Chào mừng bạn!"}
              </Text>
              <Text
                style={[styles.name, { color: palette.text }]}
                numberOfLines={2}
                ellipsizeMode="tail"
                accessibilityLabel={name}
              >
                {name}
              </Text>
              <View style={[styles.badge, { backgroundColor: palette.badge }]}>
                <View
                  style={[styles.badgeDot, { backgroundColor: palette.green }]}
                />
                <Text style={[styles.badgeText, { color: palette.green }]}>
                  {user ? "CÔNG DÂN" : "KHÁCH ECOALERT"}
                </Text>
              </View>
              <Text style={[styles.slogan, { color: palette.secondary }]}>
                Cùng xây dựng{"\n"}thành phố xanh hơn
              </Text>
            </View>
            <EcoCityIllustration motion={motion} />
          </View>
          <HeroActionButtons
            onReport={onReport}
            onTrack={onTrack}
            palette={palette}
            motionEnabled={motion.enabled}
          />
        </View>
      </LinearGradient>
    </Animated.View>
  );
});
