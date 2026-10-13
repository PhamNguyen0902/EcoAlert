import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  Bell,
  CheckCheck,
  ClipboardCheck,
  CheckCircle2,
  Clock3,
} from "lucide-react-native";
import { formatDistanceToNow, isValid } from "date-fns";
import { vi } from "date-fns/locale";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useInfiniteNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useUnreadNotificationCount,
} from "../../shared/hooks/useNotifications";
import { useCivicTheme } from "../../shared/theme/useCivicTheme";
import {
  OfficerHeader,
  OfficerBadge,
  officerStyles as s,
} from "../components/OfficerUI";
import { Button } from "../../shared/components/ui/Button";
import { notificationPresentation } from "../../shared/utils/notificationPresentation";
import { getNotificationAlertId } from "../../shared/utils/notificationNavigation";
import type { NotificationItem } from "../../shared/types/notification";
import type { OfficerStackParamList } from "../../app/navigation/types";
export function OfficerNotificationsScreen({
  navigation,
}: NativeStackScreenProps<OfficerStackParamList, "OfficerNotifications">) {
  const { colors } = useCivicTheme();
  const insets = useSafeAreaInsets();
  const query = useInfiniteNotifications();
  const unread = useUnreadNotificationCount();
  const read = useMarkNotificationRead();
  const all = useMarkAllNotificationsRead();
  const opening = useRef(false);
  const [filter, setFilter] = useState<"ALL" | "UNREAD" | "READ">("ALL");
  const items = query.data?.pages.flatMap((page) => page.items) || [];
  const visible = items.filter(
    (item) =>
      filter === "ALL" || (filter === "UNREAD" ? !item.isRead : item.isRead),
  );
  const error = () =>
    Alert.alert(
      "Chưa cập nhật được thông báo",
      "Vui lòng kiểm tra kết nối và thử lại.",
    );
  const open = async (item: NotificationItem) => {
    if (opening.current) return;
    opening.current = true;
    try {
      if (!item.isRead) await read.mutateAsync(item._id);
      const id = getNotificationAlertId(item);
      if (id) navigation.navigate("OfficerAlertDetail", { id });
    } catch {
      error();
    } finally {
      opening.current = false;
    }
  };
  return (
    <View
      style={[
        s.screen,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <OfficerHeader title="Thông báo" back={navigation.goBack} />
      <FlatList
        data={visible}
        keyExtractor={(item) => item._id}
        contentContainerStyle={[
          s.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.primary}
          />
        }
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetching)
            void query.fetchNextPage();
        }}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            <View style={s.row}>
              <Text style={[s.technical, s.grow, { color: colors.primary }]}>
                HỘP THƯ CÔNG VỤ
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đánh dấu tất cả thông báo đã đọc"
                disabled={all.isPending || !unread.data}
                onPress={() => void all.mutateAsync().catch(error)}
                style={[s.row, { minHeight: 44 }]}
              >
                <CheckCheck size={16} color={colors.cyan} />
                <Text style={[s.meta, { color: colors.cyan }]}>
                  {all.isPending ? "Đang cập nhật..." : "Đánh dấu đã đọc"}
                </Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              contentContainerStyle={{ gap: 6 }}
              showsHorizontalScrollIndicator={false}
            >
              {(
                [
                  ["ALL", "Tất cả"],
                  ["UNREAD", "Chưa đọc"],
                  ["READ", "Đã đọc"],
                ] as const
              ).map(([key, label]) => (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === key }}
                  onPress={() => setFilter(key)}
                  style={{
                    minHeight: 44,
                    paddingHorizontal: 14,
                    borderRadius: 22,
                    justifyContent: "center",
                    backgroundColor:
                      filter === key ? colors.primary : colors.elevated,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: filter === key ? "#07101F" : colors.text,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={[s.meta, { color: colors.textMuted }]}>
              {unread.data === undefined
                ? "Đang cập nhật thông báo"
                : `${unread.data} thông báo chưa đọc`}{" "}
              · Lọc trên các trang đã tải
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const content = notificationPresentation(item);
          const id = getNotificationAlertId(item);
          const tone =
            content.tone === "success"
              ? colors.primary
              : content.tone === "danger"
                ? colors.danger
                : content.tone === "attention"
                  ? colors.warning
                  : colors.cyan;
          const Icon =
            content.type === "OFFICER_ASSIGNED"
              ? ClipboardCheck
              : content.tone === "success"
                ? CheckCircle2
                : content.type === "GENERAL"
                  ? Bell
                  : Clock3;
          const date = new Date(item.createdAt);
          return (
            <Pressable
              onPress={() => void open(item)}
              disabled={read.isPending}
              accessibilityRole="button"
              accessibilityLabel={`${item.isRead ? "Đã đọc" : "Chưa đọc"}. ${content.title}. ${content.message}`}
              style={{
                borderRadius: 18,
                borderWidth: 1,
                padding: 14,
                gap: 10,
                borderColor: item.isRead ? colors.border : tone + "60",
                backgroundColor: item.isRead ? colors.surface : colors.elevated,
              }}
            >
              <View style={s.row}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: tone + "18",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={20} color={tone} />
                </View>
                <View style={s.grow}>
                  <OfficerBadge
                    label={item.isRead ? "ĐÃ ĐỌC" : "THÔNG BÁO MỚI"}
                    color={tone}
                  />
                  <Text
                    style={[s.meta, { color: colors.textMuted, marginTop: 4 }]}
                  >
                    {isValid(date)
                      ? formatDistanceToNow(date, {
                          addSuffix: true,
                          locale: vi,
                        })
                      : "Chưa có thời gian"}
                  </Text>
                </View>
              </View>
              <Text style={[s.heading, { color: colors.text }]}>
                {content.title}
              </Text>
              <Text style={[s.body, { color: colors.textSecondary }]}>
                {content.message}
              </Text>
              {id ? (
                <View style={s.row}>
                  <Text
                    style={[s.technical, s.grow, { color: colors.textMuted }]}
                  >
                    #{id.slice(-6).toUpperCase()}
                  </Text>
                  <Text style={[s.meta, { color: tone }]}>Xem nhiệm vụ ›</Text>
                </View>
              ) : (
                <Text style={[s.meta, { color: colors.textMuted }]}>
                  Thông báo hệ thống · Không có hồ sơ liên kết
                </Text>
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          query.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={[s.body, { color: colors.textMuted }]}>
              {query.isError
                ? "Không tải được thông báo. Kéo xuống để thử lại."
                : "Không có thông báo trong nhóm này."}
            </Text>
          )
        }
        ListFooterComponent={
          <View style={{ gap: 10 }}>
            {query.isFetchingNextPage && (
              <ActivityIndicator color={colors.primary} />
            )}
            {query.hasNextPage && (
              <Button
                appearance="civic"
                variant="outline"
                title="TẢI THÊM THÔNG BÁO"
                disabled={query.isFetching}
                onPress={() => void query.fetchNextPage()}
              />
            )}
            {query.isError && (
              <Button
                appearance="civic"
                variant="outline"
                title="THỬ LẠI"
                onPress={() => void query.refetch()}
              />
            )}
          </View>
        }
      />
    </View>
  );
}
