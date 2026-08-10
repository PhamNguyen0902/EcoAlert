import React from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ArrowLeft, Bell, CheckCheck } from "lucide-react-native";
import { formatDistanceToNow } from "date-fns";
import { enUS, vi } from "date-fns/locale";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CitizenStackParamList } from "../../navigation/types";
import type { Notification } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "../../hooks/useNotifications";

type Props = NativeStackScreenProps<CitizenStackParamList, "Notifications">;

import { pushNotificationService } from "../../services/pushNotificationService";
import { Send, Sparkles } from "lucide-react-native";

export const NotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const { language } = useLanguage();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const handleTestLocalPush = async () => {
    await pushNotificationService.sendLocalTestNotification(
      language === "vi" ? "Cảnh báo khẩn cấp từ EcoAlert 🚨" : "Emergency Alert from EcoAlert 🚨",
      language === "vi"
        ? "Phát hiện sự cố ô nhiễm môi trường gần bạn. Cán bộ đang kiểm tra xử lý."
        : "Environmental pollution incident detected near your area. Officers are investigating.",
    );
  };

  const copy = language === "vi"
    ? { title: "Thông báo", allRead: "Đánh dấu đã đọc", empty: "Chưa có thông báo", retry: "Không thể tải thông báo. Kéo xuống để thử lại." }
    : { title: "Notifications", allRead: "Mark all read", empty: "No notifications yet", retry: "Notifications could not be loaded. Pull down to retry." };

  const renderItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => {
        if (!item.isRead) markRead.mutate(item._id);
      }}
      style={[
        styles.notificationCard,
        {
          backgroundColor: item.isRead ? colors.card : isDark ? "rgba(34,197,94,0.12)" : "#F0FDF4",
          borderColor: item.isRead ? colors.border : isDark ? "rgba(74,222,128,0.35)" : "#BBF7D0",
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.message}`}
      accessibilityState={{ selected: !item.isRead }}
    >
      <View style={[styles.iconBox, { backgroundColor: item.isRead ? colors.surface : colors.primaryLight }]}>
        <Bell size={18} color={item.isRead ? colors.textMuted : colors.primary} />
      </View>
      <View style={styles.notificationCopy}>
        <View style={styles.notificationTitleRow}>
          <Text style={[styles.notificationTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
          {!item.isRead ? <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} /> : null}
        </View>
        <Text style={[styles.notificationMessage, { color: colors.textMuted }]}>{item.message}</Text>
        <Text style={[styles.notificationTime, { color: colors.textMuted }]}>
          {formatDistanceToNow(new Date(item.createdAt), {
            addSuffix: true,
            locale: language === "vi" ? vi : enUS,
          })}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.headerButton, { backgroundColor: colors.surface }]}
          accessibilityRole="button"
          accessibilityLabel={language === "vi" ? "Quay lại" : "Go back"}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{copy.title}</Text>
        <TouchableOpacity
          onPress={() => markAllRead.mutate()}
          disabled={markAllRead.isPending || !(notifications.data?.items.some((item) => !item.isRead))}
          style={styles.markAllButton}
          accessibilityRole="button"
          accessibilityLabel={copy.allRead}
        >
          {markAllRead.isPending ? <ActivityIndicator size="small" color={colors.primary} /> : <CheckCheck size={20} color={colors.primary} />}
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications.data?.items ?? []}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={notifications.isRefetching}
            onRefresh={() => notifications.refetch()}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <TouchableOpacity
            style={[
              styles.testPushBtn,
              {
                backgroundColor: isDark ? "rgba(34,197,94,0.18)" : colors.primaryLight,
                borderColor: colors.primary,
              },
            ]}
            onPress={() => void handleTestLocalPush()}
          >
            <Bell size={18} color={colors.primary} />
            <Text style={[styles.testPushText, { color: colors.primary }]}>
              {language === "vi" ? "Bấm để Thử nghiệm Thông báo đẩy (Push Notification)" : "Tap to Test Push Notification"}
            </Text>
            <Sparkles size={14} color={colors.primary} />
          </TouchableOpacity>
        }
        ListEmptyComponent={
          notifications.isLoading ? (
            <View style={styles.emptyState}><ActivityIndicator color={colors.primary} /></View>
          ) : (
            <View style={styles.emptyState}>
              <Bell size={36} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {notifications.isError ? copy.retry : copy.empty}
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { minHeight: 60, paddingHorizontal: 16, borderBottomWidth: 1, flexDirection: "row", alignItems: "center" },
  headerButton: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800" },
  markAllButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  notificationCard: { flexDirection: "row", gap: 12, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10 },
  iconBox: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  notificationCopy: { flex: 1 },
  notificationTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  notificationTitle: { flex: 1, fontSize: 14, fontWeight: "800" },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  notificationMessage: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  notificationTime: { fontSize: 10, fontWeight: "600", marginTop: 7 },
  emptyState: { flex: 1, minHeight: 360, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 14, fontWeight: "700", textAlign: "center", lineHeight: 20 },
  testPushBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    marginBottom: 16,
  },
  testPushText: { fontSize: 13, fontWeight: "700", flex: 1, textAlign: "center" },
});
