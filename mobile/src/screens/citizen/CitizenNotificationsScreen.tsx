import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Bell,
  ChevronRight,
  Trash2,
  CheckCircle2,
  Clock3,
  MapPin,
  ScanLine,
  XCircle,
  ClipboardCheck,
} from "lucide-react-native";
import { formatDistanceToNow, isValid } from "date-fns";
import { enUS, vi } from "date-fns/locale";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CitizenStackParamList } from "../../navigation/types";
import type { NotificationItem } from "../../types/notification";
import { CitizenHeader } from "../../components/citizen/CitizenHeader";
import {
  useInfiniteNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
} from "../../hooks/useNotifications";
import { useProfile } from "../../hooks/useAuth";
import { useLanguage } from "../../context/LanguageContext";
import { useCivicTheme } from "../../theme/useCivicTheme";
import { civicStyles, civicType } from "../../theme/civicDesign";
import { getNotificationAlertId } from "../../utils/notificationNavigation";
import { notificationPresentation } from "../../utils/notificationPresentation";

type Props = NativeStackScreenProps<CitizenStackParamList, "Notifications">;
export const CitizenNotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useCivicTheme();
  const { language } = useLanguage();
  const isVietnamese = language === "vi";
  const insets = useSafeAreaInsets();
  const { data: profile } = useProfile();
  const query = useInfiniteNotifications();
  const paginationBusy = Boolean(
    query.isFetching || query.isRefetching || query.isFetchingNextPage,
  );
  const unread = useUnreadNotificationCount();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const remove = useDeleteNotification();
  const opening = useRef(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );
  const showError = () =>
    Alert.alert(
      isVietnamese
        ? "Chưa cập nhật được thông báo"
        : "Could not update notification",
      isVietnamese
        ? "Vui lòng kiểm tra kết nối và thử lại."
        : "Check your connection and try again.",
    );
  const openItem = async (item: NotificationItem) => {
    if (opening.current) return;
    opening.current = true;
    try {
      if (!item.isRead) await markRead.mutateAsync(item._id);
      const alertId = getNotificationAlertId(item);
      if (alertId) navigation.navigate("AlertDetail", { id: alertId });
    } catch {
      showError();
    } finally {
      opening.current = false;
    }
  };
  const markAllRead = async () => {
    try {
      await markAll.mutateAsync();
    } catch {
      showError();
    }
  };
  const deleteItem = (item: NotificationItem) =>
    Alert.alert(
      isVietnamese ? "Xóa thông báo này?" : "Delete this notification?",
      notificationPresentation(item).title,
      [
        { text: isVietnamese ? "Hủy" : "Cancel", style: "cancel" },
        {
          text: isVietnamese ? "Xóa" : "Delete",
          style: "destructive",
          onPress: () => {
            void remove.mutateAsync(item._id).catch(showError);
          },
        },
      ],
    );
  const renderItem = ({ item }: { item: NotificationItem }) => {
    const content = notificationPresentation(item);
    const tone =
      content.tone === "success"
        ? colors.primary
        : content.tone === "danger"
          ? colors.danger
          : content.tone === "info"
            ? colors.cyan
            : colors.warning;
    const Icon =
      content.tone === "success"
        ? CheckCircle2
        : content.tone === "danger"
          ? XCircle
          : content.type === "AI_ANALYZED"
            ? ScanLine
            : content.type === "OFFICER_ARRIVED"
              ? MapPin
              : content.type === "OFFICER_ASSIGNED"
                ? ClipboardCheck
                : Clock3;
    const date = new Date(item.createdAt);
    const relativeTime = isValid(date)
      ? formatDistanceToNow(date, {
          addSuffix: true,
          locale: isVietnamese ? vi : enUS,
        })
      : "";
    const alertId = getNotificationAlertId(item);
    return (
      <View
        style={[
          styles.item,
          {
            backgroundColor: item.isRead ? colors.surface : colors.elevated,
            borderColor: item.isRead ? colors.border : colors.greenSoft,
          },
        ]}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`${item.isRead ? "Đã đọc. " : "Chưa đọc. "}${content.title}. ${content.message}`}
          onPress={() => void openItem(item)}
          disabled={markRead.isPending}
          style={styles.itemPress}
        >
          <View style={[styles.icon, { backgroundColor: `${tone}18` }]}>
            <Icon size={20} color={tone} />
          </View>
          <View style={styles.itemCopy}>
            <Text
              numberOfLines={2}
              style={[civicType.cardTitle, { color: colors.text }]}
            >
              {content.title}
            </Text>
            <Text
              numberOfLines={
                content.message.length > 140 && !expanded[item._id]
                  ? 4
                  : undefined
              }
              style={[civicType.body, { color: colors.textSecondary }]}
            >
              {content.message}
            </Text>
            <Text style={[civicType.meta, { color: colors.textMuted }]}>
              {relativeTime}
            </Text>
          </View>
          {!item.isRead && (
            <View
              accessibilityLabel="Chưa đọc"
              style={[styles.dot, { backgroundColor: colors.primary }]}
            />
          )}
        </TouchableOpacity>
        {content.message.length > 140 && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              expanded[item._id] ? "Thu gọn nội dung" : "Xem đầy đủ nội dung"
            }
            accessibilityState={{ expanded: Boolean(expanded[item._id]) }}
            onPress={() =>
              setExpanded((current) => ({
                ...current,
                [item._id]: !current[item._id],
              }))
            }
            style={styles.expandButton}
          >
            <Text style={[civicType.meta, { color: colors.cyan }]}>
              {expanded[item._id] ? "Thu gọn" : "Xem đầy đủ nội dung"}
            </Text>
          </TouchableOpacity>
        )}
        <View style={styles.itemFooter}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => void openItem(item)}
            disabled={markRead.isPending}
            style={styles.detailButton}
          >
            <Text style={[civicType.meta, { color: colors.primary }]}>
              {alertId
                ? "Xem báo cáo"
                : item.isRead
                  ? "Đã đọc"
                  : "Đánh dấu đã đọc"}
            </Text>
            {alertId && <ChevronRight size={14} color={colors.primary} />}
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${isVietnamese ? "Xóa thông báo" : "Delete notification"}: ${content.title}`}
            disabled={remove.isPending}
            onPress={() => deleteItem(item)}
            style={styles.deleteButton}
          >
            <Trash2 size={15} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <CitizenHeader
        title={isVietnamese ? "Thông báo" : "Notifications"}
        onBack={() => navigation.goBack()}
        trailing={
          (unread.data ?? 0) > 0 ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={
                isVietnamese ? "Đánh dấu tất cả đã đọc" : "Mark all as read"
              }
              disabled={markAll.isPending}
              onPress={() => void markAllRead()}
              style={styles.markAll}
            >
              {markAll.isPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.markAllText, { color: colors.primary }]}>
                  {isVietnamese ? "Đánh dấu đã đọc" : "Read all"}
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <View />
          )
        }
      />
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 24 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !query.isFetchingNextPage}
            onRefresh={() => {
              void query.refetch();
              void unread.refetch();
            }}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            {query.isLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Bell size={40} color={colors.textMuted} />
            )}
            <Text style={[civicType.section, { color: colors.text }]}>
              {query.isLoading
                ? isVietnamese
                  ? "Đang tải thông báo..."
                  : "Loading notifications..."
                : !profile
                  ? isVietnamese
                    ? "Đăng nhập để xem thông báo"
                    : "Sign in to view notifications"
                  : query.isError
                    ? isVietnamese
                      ? "Không tải được thông báo"
                      : "Could not load notifications"
                    : isVietnamese
                      ? "Chưa có thông báo"
                      : "No notifications yet"}
            </Text>
            <Text
              style={[
                civicType.body,
                styles.emptyText,
                { color: colors.textMuted },
              ]}
            >
              {isVietnamese
                ? "Các cập nhật về báo cáo của bạn sẽ xuất hiện tại đây."
                : "Updates about your reports will appear here."}
            </Text>
          </View>
        }
        ListFooterComponent={
          query.hasNextPage || query.isError ? (
            <TouchableOpacity
              accessibilityRole="button"
              disabled={paginationBusy}
              accessibilityState={{
                disabled: paginationBusy,
                busy: paginationBusy,
              }}
              onPress={() => {
                if (paginationBusy) return;
                if (query.isError) void query.refetch({ cancelRefetch: false });
                else void query.fetchNextPage({ cancelRefetch: false });
              }}
              style={[
                civicStyles.secondaryButton,
                { borderColor: colors.border },
              ]}
            >
              {query.isFetchingNextPage ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={[civicType.button, { color: colors.primary }]}>
                  {query.isError
                    ? isVietnamese
                      ? "Thử lại"
                      : "Retry"
                    : isVietnamese
                      ? "Xem thông báo trước đó"
                      : "Load earlier notifications"}
                </Text>
              )}
            </TouchableOpacity>
          ) : null
        }
      />
    </View>
  );
};
const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: 16, gap: 12 },
  item: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  itemPress: {
    padding: 16,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    paddingBottom: 8,
  },
  itemCopy: { flex: 1, minWidth: 0, gap: 6 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  itemFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 62,
    paddingRight: 6,
  },
  detailButton: {
    minHeight: 44,
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    flexShrink: 1,
  },
  expandButton: {
    marginLeft: 62,
    marginRight: 16,
    minHeight: 36,
    justifyContent: "center",
  },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  deleteButton: {
    alignSelf: "flex-end",
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  markAll: { minHeight: 44, justifyContent: "center", maxWidth: 125 },
  markAllText: { fontSize: 11, fontWeight: "700", textAlign: "right" },
  empty: {
    paddingTop: 64,
    paddingHorizontal: 16,
    gap: 16,
    alignItems: "center",
  },
  emptyText: { textAlign: "center" },
});
