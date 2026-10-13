import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowUpRight, Camera, ClipboardList } from "lucide-react-native";
import type { HeroPalette } from "./heroStyles";

interface Props {
  onReport: () => void;
  onTrack: () => void;
  palette: HeroPalette;
  motionEnabled: boolean;
}
function HeroAction({
  onPress,
  report,
  palette,
  motionEnabled,
}: {
  onPress: () => void;
  report: boolean;
  palette: HeroPalette;
  motionEnabled: boolean;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  useEffect(() => {
    cancelAnimation(scale);
    scale.value = 1;
    return () => cancelAnimation(scale);
  }, [motionEnabled, scale]);
  const press = (down: boolean) => {
    scale.value = withTiming(down && motionEnabled ? 0.97 : 1, {
      duration: motionEnabled ? 110 : 0,
    });
  };
  const title = report ? "Báo cáo rác" : "Theo dõi";
  const subtitle = report ? "Gửi phản ánh mới" : "Báo cáo của tôi";
  const color = report ? "#07101F" : palette.text;
  const Icon = report ? Camera : ClipboardList;
  return (
    <Animated.View style={[styles.action, animated]}>
      <Pressable
        style={styles.pressable}
        onPress={onPress}
        onPressIn={() => press(true)}
        onPressOut={() => press(false)}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${subtitle}`}
      >
        <LinearGradient
          colors={report ? palette.report : palette.tracking}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.button,
            { borderColor: report ? "rgba(134,239,172,0.4)" : palette.border },
          ]}
        >
          <Icon
            size={17}
            color={report ? color : palette.cyan}
            strokeWidth={1.8}
          />
          <View style={styles.copy}>
            <Text style={[styles.title, { color }]}>{title}</Text>
            <Text
              style={[
                styles.subtitle,
                { color: report ? "#16452E" : palette.secondary },
              ]}
            >
              {subtitle}
            </Text>
          </View>
          <ArrowUpRight size={10} color={report ? "#166534" : palette.cyan} />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}
export function HeroActionButtons({
  onReport,
  onTrack,
  palette,
  motionEnabled,
}: Props) {
  return (
    <View style={styles.row}>
      <HeroAction
        report
        onPress={onReport}
        palette={palette}
        motionEnabled={motionEnabled}
      />
      <HeroAction
        report={false}
        onPress={onTrack}
        palette={palette}
        motionEnabled={motionEnabled}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  action: { flex: 1, minWidth: 0 },
  pressable: { flex: 1 },
  button: {
    flex: 1,
    minHeight: 64,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 13, lineHeight: 18, fontWeight: "800" },
  subtitle: { fontSize: 10, lineHeight: 14, fontWeight: "500" },
});
