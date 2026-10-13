import React, { useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  Bell,
  ChevronRight,
  Leaf,
  Search,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { useCivicTheme } from "../../../theme/useCivicTheme";
import { civicStyles, civicType } from "../../../theme/civicDesign";
import { unreadBadgeLabel } from "../../../utils/notificationNavigation";
import type { User } from "../../../shared/types/index";

export const CitizenAvatar = ({
  user,
  size = 36,
}: {
  user?: User | null;
  size?: number;
}) => {
  const { colors } = useCivicTheme();
  const [failedUri, setFailedUri] = useState<string | undefined>();
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.greenSoft,
          borderColor: colors.primary,
        },
      ]}
    >
      {user?.avatar && user.avatar !== failedUri ? (
        <Image
          source={{ uri: user.avatar }}
          style={{ width: "100%", height: "100%" }}
          accessibilityLabel="Ảnh đại diện"
          onError={() => setFailedUri(user.avatar)}
        />
      ) : (
        <Text
          style={{
            color: colors.primary,
            fontSize: size * 0.32,
            fontWeight: "800",
          }}
        >
          {user?.fullName?.trim().charAt(0).toUpperCase() || "E"}
        </Text>
      )}
    </View>
  );
};

/** Presentational header; its callers retain ownership of queries and navigation. */
export const CitizenTopBar = ({
  title,
  user,
  unreadCount = 0,
  onNotifications,
  onProfile,
}: {
  title: string;
  user?: User | null;
  unreadCount?: number;
  onNotifications: () => void;
  onProfile: () => void;
}) => {
  const { colors } = useCivicTheme();
  const badge = unreadBadgeLabel(unreadCount);
  return (
    <View
      style={[
        styles.header,
        { backgroundColor: colors.surface, borderBottomColor: colors.divider },
      ]}
    >
      <View style={[styles.brandIcon, { backgroundColor: colors.greenSoft }]}>
        <Leaf size={19} color={colors.primary} />
      </View>
      <Text
        style={[styles.headerTitle, { color: colors.text }]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <Pressable
        onPress={onNotifications}
        style={civicStyles.iconButton}
        accessibilityRole="button"
        accessibilityLabel={`Thông báo${unreadCount ? `, ${unreadCount} chưa đọc` : ""}`}
      >
        <Bell size={20} color={colors.textSecondary} />
        {badge && (
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </Pressable>
      <Pressable
        onPress={onProfile}
        style={civicStyles.iconButton}
        accessibilityRole="button"
        accessibilityLabel="Hồ sơ cá nhân"
      >
        <CitizenAvatar user={user} />
      </Pressable>
    </View>
  );
};

export const CitizenSectionHeading = ({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) => {
  const { colors } = useCivicTheme();
  return (
    <View style={styles.section}>
      <View style={[styles.accent, { backgroundColor: colors.primary }]} />
      <Text style={[civicType.section, styles.flex, { color: colors.text }]}>
        {title}
      </Text>
      {action && onPress && (
        <Pressable
          onPress={onPress}
          style={styles.sectionAction}
          accessibilityRole="button"
          accessibilityLabel={`${action}: ${title}`}
        >
          <Text style={[civicType.meta, { color: colors.cyan }]}>{action}</Text>
          <ChevronRight size={14} color={colors.cyan} />
        </Pressable>
      )}
    </View>
  );
};

export const CitizenActionTile = ({
  icon: Icon,
  title,
  subtitle,
  onPress,
  tone = "green",
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
  tone?: "green" | "cyan" | "amber";
  compact?: boolean;
}) => {
  const { colors } = useCivicTheme();
  const color =
    tone === "cyan"
      ? colors.cyan
      : tone === "amber"
        ? colors.warning
        : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      style={({ pressed }) => [
        styles.tile,
        compact && styles.compactTile,
        {
          backgroundColor:
            compact && tone === "green" ? colors.greenSoft : colors.elevated,
          borderColor:
            compact && tone === "green" ? `${colors.primary}55` : colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View style={styles.tileTop}>
        <View style={[styles.tileIcon, { backgroundColor: `${color}18` }]}>
          <Icon size={22} color={color} />
        </View>
        <ChevronRight size={15} color={colors.textMuted} />
      </View>
      <Text style={[civicType.cardTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[civicType.meta, { color: colors.textMuted }]}>
        {subtitle}
      </Text>
    </Pressable>
  );
};

export const CitizenSearch = ({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) => {
  const { colors } = useCivicTheme();
  return (
    <View
      style={[
        styles.search,
        { backgroundColor: colors.elevated, borderColor: colors.border },
      ]}
    >
      <Search size={18} color={colors.cyan} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        accessibilityLabel={placeholder}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { color: colors.text }]}
        returnKeyType="search"
        autoCorrect={false}
      />
      {value !== "" && (
        <Pressable
          onPress={() => onChangeText("")}
          style={civicStyles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Xóa tìm kiếm"
        >
          <X size={17} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
};

export const CitizenStat = ({
  label,
  value,
  tone = "green",
}: {
  label: string;
  value: number | string;
  tone?: "green" | "cyan" | "amber";
}) => {
  const { colors } = useCivicTheme();
  const color =
    tone === "cyan"
      ? colors.cyan
      : tone === "amber"
        ? colors.warning
        : colors.primary;
  return (
    <View
      style={[
        styles.stat,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text style={[civicType.meta, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <View style={[styles.statLine, { backgroundColor: color }]} />
    </View>
  );
};

export const CitizenSettingsRow = ({
  icon: Icon,
  title,
  detail,
  onPress,
  children,
}: {
  icon: LucideIcon;
  title: string;
  detail?: string;
  onPress?: () => void;
  children?: React.ReactNode;
}) => {
  const { colors } = useCivicTheme();
  const content = (
    <>
      <View style={[styles.tileIcon, { backgroundColor: colors.cyanSoft }]}>
        <Icon size={18} color={colors.cyan} />
      </View>
      <View style={styles.flex}>
        <Text style={[civicType.cardTitle, { color: colors.text }]}>
          {title}
        </Text>
        {detail && (
          <Text style={[civicType.meta, { color: colors.textMuted }]}>
            {detail}
          </Text>
        )}
      </View>
      {children}
      {onPress && <ChevronRight size={16} color={colors.textMuted} />}
    </>
  );
  return onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, detail].filter(Boolean).join(". ")}
      style={styles.settingsRow}
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.settingsRow}>{content}</View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  avatar: {
    borderWidth: 1.5,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 8,
  },
  brandIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { flex: 1, minWidth: 0, fontSize: 17, fontWeight: "800" },
  badge: {
    position: "absolute",
    top: 1,
    right: 1,
    minWidth: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    alignItems: "center",
  },
  badgeText: { fontSize: 10, fontWeight: "800", color: "#07101F" },
  section: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 44,
  },
  accent: { width: 3, height: 16, borderRadius: 2 },
  sectionAction: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    gap: 2,
  },
  tile: {
    flex: 1,
    minWidth: 0,
    minHeight: 122,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
  },
  compactTile: { minHeight: 108 },
  tileTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  tileIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    paddingRight: 4,
    gap: 8,
    borderWidth: 1,
    borderRadius: 16,
  },
  input: { flex: 1, minWidth: 0, fontSize: 13, paddingVertical: 12 },
  stat: {
    flex: 1,
    minWidth: 0,
    padding: 12,
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  statValue: { fontSize: 24, fontWeight: "800", fontVariant: ["tabular-nums"] },
  statLine: { height: 2, width: "40%", borderRadius: 2, marginTop: 4 },
  settingsRow: {
    minHeight: 66,
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
});
