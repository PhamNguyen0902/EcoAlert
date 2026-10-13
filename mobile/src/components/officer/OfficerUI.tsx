import React from "react";
import {
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
import type { OfficerStackParamList } from "../../navigation/types";
import { useProfile } from "../../features/auth/hooks/useAuth";
import { useUnreadNotificationCount } from "../../features/notifications/hooks/useNotifications";
import { useCivicTheme } from "../../theme/useCivicTheme";
import { civicType } from "../../theme/civicDesign";
import { unreadBadgeLabel } from "../../features/notifications/model/notificationNavigation";

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
});
