import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ArrowLeft, Bell, Leaf } from "lucide-react-native";
import { useCivicTheme } from "../../theme/useCivicTheme";
import { civicRadius, civicSpace, civicStyles } from "../../theme/civicDesign";
import { unreadBadgeLabel } from "../../utils/notificationNavigation";

interface Props {
  title?: string;
  onBack?: () => void;
  avatarLabel?: string;
  onProfile?: () => void;
  onNotifications?: () => void;
  unreadCount?: number;
  trailing?: React.ReactNode;
}

/** Presentation only: no profile fetch, navigation or notification subscriptions. */
export const CitizenHeader: React.FC<Props> = ({
  title = "EcoAlert",
  onBack,
  avatarLabel = "EA",
  onProfile,
  onNotifications,
  unreadCount = 0,
  trailing,
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
      {onBack && (
        <TouchableOpacity
          onPress={onBack}
          style={civicStyles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
      )}
      <View style={styles.brand}>
        <Leaf size={20} color={colors.primary} />
        <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>
          {title}
        </Text>
      </View>
      <View style={styles.actions}>
        {trailing ?? (
          <>
            <TouchableOpacity
              disabled={!onNotifications}
              onPress={onNotifications}
              style={civicStyles.iconButton}
              accessibilityRole="button"
              accessibilityLabel={
                unreadCount > 0
                  ? `Thông báo, ${unreadCount} chưa đọc`
                  : "Thông báo"
              }
              accessibilityState={{ disabled: !onNotifications }}
            >
              <Bell
                size={18}
                color={onNotifications ? colors.text : colors.textMuted}
              />
              {badge && (
                <View
                  style={[
                    styles.notificationBadge,
                    {
                      backgroundColor: colors.primary,
                      borderColor: colors.surface,
                    },
                  ]}
                >
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              disabled={!onProfile}
              onPress={onProfile}
              style={civicStyles.iconButton}
              accessibilityRole="button"
              accessibilityLabel="Hồ sơ cá nhân"
            >
              <View
                style={[styles.avatar, { backgroundColor: colors.greenSoft }]}
              >
                <Text style={[styles.avatarText, { color: colors.primary }]}>
                  {avatarLabel}
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 58,
    paddingHorizontal: civicSpace.lg,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: civicSpace.sm,
  },
  brand: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: civicSpace.sm,
  },
  title: { flexShrink: 1, fontSize: 16, fontWeight: "700" },
  actions: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: civicRadius.round,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 11, fontWeight: "800" },
  notificationBadge: {
    position: "absolute",
    top: 3,
    right: 3,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 9, fontWeight: "800", color: "#07101F" },
});
