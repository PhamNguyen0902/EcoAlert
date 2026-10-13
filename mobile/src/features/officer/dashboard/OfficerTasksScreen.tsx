import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOfficerTasks, useCurrentShift } from "../../../hooks/useAlerts";
import { useProfile } from "../../auth/hooks/useAuth";
import { useCivicTheme } from "../../../theme/useCivicTheme";
import {
  useForegroundScreen,
  useScreenClock,
} from "../../../hooks/useForegroundScreen";
import {
  OfficerBadge,
  OfficerCard,
  OfficerContours,
  OfficerHeader,
  OfficerMetric,
  OfficerSection,
  officerStyles as s,
} from "../../../components/officer/OfficerUI";
import { OfficerTaskCard } from "../../../components/officer/OfficerTaskCard";
import { OfficerTaskFilters } from "../../../components/officer/OfficerTaskFilters";
import { OfficerEntrance } from "../components/OfficerEntrance";
import { Button } from "../../../components/ui/Button";
import {
  filterOfficerTasks,
  type OfficerTaskFilter,
} from "../../../utils/officerWorkflow";
import { officerDate, officerTimeline } from "../../../utils/officerPresentation";
import type { OfficerStackParamList } from "../../../navigation/types";
export const OfficerTasksScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<OfficerStackParamList>>();
  const insets = useSafeAreaInsets();
  const { colors } = useCivicTheme();
  const query = useOfficerTasks(1, 100, undefined, { allPages: true });
  const shift = useCurrentShift();
  const { data: profile } = useProfile();
  const active = useForegroundScreen();
  const now = useScreenClock(60_000, active);
  const [filter, setFilter] = useState<OfficerTaskFilter>("ALL");
  const tasks = filterOfficerTasks(query.data?.items || [], "ALL");
  const hour = new Date(now).getHours();
  const greeting =
    hour < 12
      ? "Chào buổi sáng"
      : hour < 18
        ? "Chào buổi chiều"
        : "Chào buổi tối";
  const priority = tasks
    .filter((t) => ["ASSIGNED", "IN_PROGRESS"].includes(t.status.toUpperCase()))
    .sort((a, b) => {
      const weight: Record<string, number> = {
        critical: 4,
        high: 3,
        medium: 2,
        low: 1,
      };
      return (
        (weight[b.severity?.toLowerCase() || ""] || 0) -
        (weight[a.severity?.toLowerCase() || ""] || 0)
      );
    })[0];
  const activity = tasks
    .flatMap((task) =>
      officerTimeline(task)
        .filter((step, index) => step.done && index !== 4)
        .map((step) => ({ ...step, task })),
    )
    .sort((a, b) => Date.parse(b.at!) - Date.parse(a.at!))
    .slice(0, 4);
  const detail = (id: string) =>
    navigation.navigate("OfficerAlertDetail", { id });
  return (
    <View
      style={[
        s.screen,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <OfficerHeader title="Nhiệm vụ" />
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        <View style={[s.row, { flexWrap: "wrap" }]}>
          <OfficerBadge label="CÁN BỘ · ECOALERT" />
          <OfficerBadge
            label={
              query.isFetching
                ? "ĐANG ĐỒNG BỘ"
                : query.isError
                  ? "CHƯA ĐỒNG BỘ"
                  : "DỮ LIỆU ĐÃ TẢI"
            }
            color={colors.cyan}
          />
          {shift.data?.status === "ACTIVE" && (
            <OfficerBadge label="ĐANG TRONG CA" />
          )}
        </View>
        <View style={{ gap: 6 }}>
          <Text style={[s.heading, { color: colors.text }]}>
            {greeting}, {profile?.fullName || "cán bộ"}
          </Text>
          <Text style={[s.body, { color: colors.textMuted }]}>
            Cùng EcoAlert xử lý các điểm rác và xây dựng môi trường xanh hơn.
          </Text>
        </View>
        <OfficerEntrance>
          <OfficerCard accent style={{ overflow: "hidden", padding: 16 }}>
            <OfficerContours />
            <Text style={[s.technical, { color: colors.primary }]}>
              ĐIỀU PHỐI & KIỂM SOÁT MÔI TRƯỜNG
            </Text>
            <Text style={[s.title, { color: colors.text }]}>
              Nhiệm vụ của bạn
            </Text>
            <Text style={[s.body, { color: colors.textSecondary }]}>
              Theo dõi và xử lý các phản ánh môi trường được phân công theo thời
              gian thực.
            </Text>
            <View style={s.row}>
              {(
                [
                  ["NEW", "Chờ xử lý", colors.warning],
                  ["ACTIVE", "Đang làm", colors.cyan],
                  ["COMPLETED", "Đã xử lý", colors.primary],
                ] as const
              ).map(([key, label, tone]) => (
                <OfficerMetric
                  key={key}
                  label={label}
                  tone={tone}
                  value={
                    query.data ? filterOfficerTasks(tasks, key).length : "—"
                  }
                />
              ))}
            </View>
          </OfficerCard>
        </OfficerEntrance>
        {query.isLoading && <ActivityIndicator color={colors.primary} />}
        {query.isError && (
          <OfficerCard>
            <Text accessibilityRole="alert" style={{ color: colors.danger }}>
              Không tải được nhiệm vụ. Kéo xuống để thử lại.
            </Text>
          </OfficerCard>
        )}
        <OfficerSection
          title="Nhiệm vụ cần ưu tiên"
          action="Xem thêm"
          onPress={() => navigation.navigate("OfficerTaskList")}
        />
        {priority ? (
          <OfficerCard>
            <OfficerBadge label="ƯU TIÊN THEO MỨC ĐỘ" color={colors.warning} />
            <OfficerTaskCard
              task={priority}
              onPress={() => detail(priority._id)}
              compact
            />
            <Button
              appearance="civic"
              title="XEM CHI TIẾT NHIỆM VỤ"
              onPress={() => detail(priority._id)}
            />
            <Button
              appearance="civic"
              variant="ghost"
              title="ĐIỀU HƯỚNG BẢN ĐỒ"
              onPress={() =>
                navigation.navigate("OfficerTabs", {
                  screen: "OfficerMapTab",
                  params: { selectedId: priority._id },
                })
              }
            />
          </OfficerCard>
        ) : (
          <Text style={[s.body, { color: colors.textMuted }]}>
            {query.data
              ? "Chưa có nhiệm vụ cần xử lý."
              : "Chờ tải nhiệm vụ ưu tiên."}
          </Text>
        )}
        <OfficerSection
          title="Danh sách nhiệm vụ"
          action="Tất cả"
          onPress={() => navigation.navigate("OfficerTaskList")}
        />
        <OfficerTaskFilters tasks={tasks} value={filter} onChange={setFilter} />
        {filterOfficerTasks(tasks, filter)
          .slice(0, 3)
          .map((task) => (
            <OfficerTaskCard
              key={task._id}
              task={task}
              onPress={() => detail(task._id)}
              compact
            />
          ))}
        {!filterOfficerTasks(tasks, filter).length && query.data && (
          <Text style={[s.body, { color: colors.textMuted }]}>
            Không có nhiệm vụ trong nhóm này.
          </Text>
        )}
        <OfficerSection title="Hoạt động gần đây" />
        <OfficerCard>
          {activity.map((event, index) => (
            <View
              key={`${event.task._id}-${event.label}`}
              style={[s.row, { alignItems: "flex-start" }]}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: index ? colors.cyan : colors.primary,
                  marginTop: 5,
                }}
              />
              <View style={s.grow}>
                <Text style={[s.body, { color: colors.text }]}>
                  {event.label}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[s.meta, { color: colors.textMuted }]}
                >
                  {event.task.title}
                </Text>
                <Text style={[s.meta, { color: colors.cyan }]}>
                  {officerDate(event.at)}
                </Text>
              </View>
            </View>
          ))}
          {!activity.length && (
            <Text style={[s.body, { color: colors.textMuted }]}>
              Chưa có hoạt động được ghi nhận.
            </Text>
          )}
        </OfficerCard>
      </ScrollView>
    </View>
  );
};
