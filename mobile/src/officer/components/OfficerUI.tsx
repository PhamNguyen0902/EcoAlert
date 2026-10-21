import React, { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Leaf,
  UserRound,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { Alert } from "../../shared/types";
import type { OfficerStackParamList } from "../../app/navigation/types";
import { useProfile } from "../../auth/hooks/useAuth";
import { useUnreadNotificationCount } from "../../shared/hooks/useNotifications";
import { useReducedMotion } from "../../shared/hooks/useReducedMotion";
import { useCivicTheme } from "../../shared/theme/useCivicTheme";
import { civicType } from "../../shared/theme/civicDesign";
import { unreadBadgeLabel } from "../../shared/utils/notificationNavigation";
import {
  getOfficerWorkflowStep,
  type OfficerWorkflowStepNumber,
} from "../utils/officerWorkflow";

export const officerStyles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 18, paddingBottom: 24 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  grow: { flex: 1, minWidth: 0 },
  title: { fontSize: 21, lineHeight: 28, fontWeight: "800" },
  heading: { fontSize: 15, lineHeight: 21, fontWeight: "800" },
  body: { fontSize: 13, lineHeight: 20 },
  meta: { fontSize: 11, lineHeight: 17 },
  technical: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 0.7,
  },
  card: { padding: 14, borderWidth: 1, borderRadius: 18, gap: 12 },
});

export function OfficerHeader({
  title,
  back,
  disabled = false,
}: {
  title: string;
  back?: () => void;
  disabled?: boolean;
}) {
  const { colors, isDark } = useCivicTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<OfficerStackParamList>>();
  const { data: profile } = useProfile();
  const unread = useUnreadNotificationCount();
  return (
    <LinearGradient
      colors={
        isDark ? ["#101D31", "#0B1628"] : [colors.surface, colors.background]
      }
      style={[styles.header, { borderBottomColor: colors.border }]}
    >
      <Pressable
        disabled={disabled}
        onPress={
          back ||
          (() =>
            navigation.navigate("OfficerTabs", { screen: "OfficerTasksTab" }))
        }
        accessibilityRole="button"
        accessibilityLabel={back ? "Quay lại" : "Trang nhiệm vụ"}
        style={styles.icon}
      >
        {back ? (
          <ArrowLeft size={21} color={colors.text} />
        ) : (
          <Leaf size={22} color={colors.primary} />
        )}
      </Pressable>
      <View style={officerStyles.grow}>
        <Text style={[styles.brand, { color: colors.primary }]}>
          ECOALERT FIELD OPERATIONS
        </Text>
        <Text
          accessibilityRole="header"
          style={[officerStyles.heading, { color: colors.text }]}
        >
          {title}
        </Text>
      </View>
      <Pressable
        disabled={disabled}
        onPress={() => navigation.navigate("OfficerNotifications")}
        style={styles.icon}
        accessibilityRole="button"
        accessibilityLabel={`Thông báo${unread.data ? `, ${unread.data} chưa đọc` : ""}`}
      >
        <Bell size={20} color={colors.textMuted} />
        {Boolean(unread.data) && (
          <View style={styles.dot}>
            <Text style={styles.unreadCount}>
              {unreadBadgeLabel(unread.data || 0)}
            </Text>
          </View>
        )}
      </Pressable>
      <Pressable
        disabled={disabled}
        onPress={() =>
          navigation.navigate("OfficerTabs", { screen: "OfficerProfileTab" })
        }
        accessibilityRole="button"
        accessibilityLabel="Thông tin cán bộ"
        style={[styles.avatar, { backgroundColor: colors.greenSoft }]}
      >
        {profile?.avatar ? (
          <Image source={{ uri: profile.avatar }} style={styles.avatar} />
        ) : (
          <UserRound size={18} color={colors.primary} />
        )}
      </Pressable>
    </LinearGradient>
  );
}

export function OfficerCard({
  children,
  style,
  accent = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accent?: boolean;
}) {
  const { colors } = useCivicTheme();
  return (
    <View
      style={[
        officerStyles.card,
        {
          backgroundColor: accent ? colors.greenSoft : colors.surface,
          borderColor: accent ? colors.primary + "40" : colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function OfficerBadge({
  label,
  color,
}: {
  label: string;
  color?: string;
}) {
  const { colors } = useCivicTheme();
  const tone = color || colors.primary;
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: tone + "18", borderColor: tone + "30" },
      ]}
    >
      <Text style={[styles.badgeText, { color: tone }]}>{label}</Text>
    </View>
  );
}
export function OfficerSection({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  const { colors } = useCivicTheme();
  return (
    <View style={[officerStyles.row, { justifyContent: "space-between" }]}>
      <Text
        accessibilityRole="header"
        style={[
          officerStyles.heading,
          officerStyles.grow,
          { color: colors.text },
        ]}
      >
        {title}
      </Text>
      {action && onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          style={styles.sectionAction}
        >
          <Text style={[officerStyles.meta, { color: colors.cyan }]}>
            {action}
          </Text>
          <ChevronRight size={14} color={colors.cyan} />
        </Pressable>
      ) : null}
    </View>
  );
}
export function OfficerMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: string;
}) {
  const { colors } = useCivicTheme();
  return (
    <View style={[styles.metric, { backgroundColor: colors.elevated }]}>
      <View style={[styles.metricLine, { backgroundColor: tone }]} />
      <Text style={[styles.metricValue, { color: tone }]}>{value}</Text>
      <Text style={[civicType.meta, { color: colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}
/** Static vector contours: no timer, map/camera workload or bitmap dependency. */
export function OfficerContours() {
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 360 200"
        preserveAspectRatio="xMidYMid slice"
      >
        <Path
          d="M155 -20C250 30 200 85 360 65M120 -20C225 35 175 105 365 95M80 -20C200 40 145 130 365 125M40 -20C160 50 110 155 365 155M0 -20C135 75 70 180 365 185"
          stroke="#22C55E"
          strokeOpacity={0.12}
          strokeWidth={1}
          fill="none"
        />
      </Svg>
    </View>
  );
}

function ActiveStepHaloRing() {
  const reducedMotion = useReducedMotion();
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      pulseAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1100,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim, reducedMotion]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.activeHaloRing,
        {
          opacity: reducedMotion
            ? 0.35
            : pulseAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.55, 0.14],
              }),
          transform: [
            {
              scale: reducedMotion
                ? 1.18
                : pulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1.05, 1.38],
                  }),
            },
          ],
        },
      ]}
    />
  );
}

export function OfficerStepProgressBar({
  task,
  step,
}: {
  task?: Pick<Alert, "status" | "checkIn"> | null;
  step?: OfficerWorkflowStepNumber;
}) {
  const { colors } = useCivicTheme();
  const progress = getOfficerWorkflowStep(task, step);
  const currentStepItem =
    progress.steps.find((item) => item.step === progress.currentStep) ||
    progress.steps[0];

  const fillFraction = progress.allCompleted
    ? 1
    : progress.currentStep === 3
      ? 1
      : progress.currentStep === 2
        ? 0.5
        : 0;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={
        progress.allCompleted
          ? "Tiến trình xử lý hiện trường: Đã hoàn thành cả 3 bước"
          : `Tiến trình xử lý hiện trường, bước ${progress.currentStep} trên 3: ${currentStepItem.label}`
      }
      accessibilityValue={{
        min: 1,
        max: 3,
        now: progress.currentStep,
      }}
      style={styles.stepperGlassCard}
    >
      <View style={styles.stepperHeader}>
        <Text style={[officerStyles.technical, { color: colors.cyan }]}>
          QUY TRÌNH XỬ LÝ 3 BƯỚC
        </Text>
        <Text style={[officerStyles.technical, { color: colors.primary }]}>
          {progress.allCompleted
            ? "HOÀN THÀNH 3/3 BƯỚC"
            : `BƯỚC ${progress.currentStep}/3 · ${currentStepItem.label.toUpperCase()}`}
        </Text>
      </View>

      <View style={styles.stepperTrack}>
        {/* Đường nối liên tục xuyên suốt từ tâm Bước 1 -> Bước 2 -> Bước 3 */}
        <View style={styles.continuousRailWrap} pointerEvents="none">
          <View
            style={[
              styles.continuousRailFill,
              {
                width: `${fillFraction * 100}%`,
                backgroundColor: progress.allCompleted
                  ? "#10B981"
                  : "#38BDF8",
              },
            ]}
          />
        </View>

        {progress.steps.map((item) => {
          const isCompleted = item.done;
          const isActive = item.active;
          const circleBg = isCompleted
            ? "#10B981"
            : isActive
              ? "#0EA5E9"
              : "#0F172A";
          const circleBorder = isCompleted
            ? "#10B981"
            : isActive
              ? "#38BDF8"
              : "#334155";
          const textColor = isCompleted
            ? "#10B981"
            : isActive
              ? colors.text
              : "#64748B";

          return (
            <View key={item.step} style={styles.stepNode}>
              <View style={styles.stepCircleWrap}>
                {isActive && <ActiveStepHaloRing />}
                <View
                  style={[
                    styles.stepCircle,
                    {
                      backgroundColor: circleBg,
                      borderColor: circleBorder,
                    },
                  ]}
                >
                  {isCompleted ? (
                    <Text style={styles.stepCheckText}>✓</Text>
                  ) : (
                    <Text
                      style={[
                        styles.stepNumberText,
                        { color: isActive ? "#07101F" : "#64748B" },
                      ]}
                    >
                      {item.step}
                    </Text>
                  )}
                </View>
              </View>
              <Text
                numberOfLines={2}
                style={[
                  styles.stepLabel,
                  {
                    color: textColor,
                    fontWeight: isActive || isCompleted ? "800" : "600",
                  },
                ]}
              >
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 12,
    minHeight: 62,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  brand: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  icon: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4ADE80",
    right: 1,
    top: 3,
  },
  unreadCount: { fontSize: 8, fontWeight: "800", color: "#07101F" },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 7,
  },
  badgeText: { fontSize: 10, lineHeight: 14, fontWeight: "800" },
  sectionAction: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  metric: { flex: 1, minWidth: 0, padding: 10, gap: 4, borderRadius: 10 },
  metricLine: { width: 18, height: 2, borderRadius: 1 },
  metricValue: { fontSize: 24, fontWeight: "800", lineHeight: 30 },
  stepperGlassCard: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 16,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.16)",
    padding: 14,
    gap: 12,
  },
  stepperHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  stepperTrack: {
    position: "relative",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  continuousRailWrap: {
    position: "absolute",
    top: 13.5,
    left: "16.66%",
    right: "16.66%",
    height: 3,
    borderRadius: 999,
    backgroundColor: "#1E293B",
    overflow: "hidden",
  },
  continuousRailFill: {
    height: "100%",
    borderRadius: 999,
  },
  stepNode: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 2,
    zIndex: 2,
  },
  stepCircleWrap: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  activeHaloRing: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "#38BDF8",
    backgroundColor: "rgba(14, 165, 233, 0.22)",
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  stepCheckText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: "800",
  },
  stepLabel: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: "center",
  },
});
