import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CheckCircle2,
  Eye,
  FileCheck2,
  Images,
  Search,
} from "lucide-react-native";
import { useOfficerTasks } from "../../shared/hooks/useAlerts";
import { useCivicTheme } from "../../shared/theme/useCivicTheme";
import {
  OfficerBadge,
  OfficerCard,
  OfficerContours,
  OfficerHeader,
  OfficerMetric,
  officerStyles as s,
} from "../components/OfficerUI";
import { OfficerTaskCard } from "../components/OfficerTaskCard";
import { OfficerEvidenceComparison } from "../components/OfficerEvidenceComparison";
import { OfficerEntrance } from "../components/OfficerEntrance";
import { Button } from "../../shared/components/ui/Button";
import { filterOfficerTasks } from "../utils/officerWorkflow";
import {
  officerDate,
  officerImage,
  officerReference,
  searchOfficerTasks,
} from "../utils/officerPresentation";
import type { OfficerStackParamList } from "../../app/navigation/types";

type HistoryFilter = "ALL" | "RESOLVED" | "CLOSED";

// Màn hình lịch sử các sự cố đã xử lý hoàn tất (RESOLVED, CLOSED) kèm đối chiếu ảnh Trước/Sau
export function OfficerHistoryScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<OfficerStackParamList>>();
  const insets = useSafeAreaInsets();
  const { colors } = useCivicTheme();
  const query = useOfficerTasks(1, 100, undefined, { allPages: true });

  const [statusFilter, setStatusFilter] = useState<HistoryFilter>("ALL");
  const [search, setSearch] = useState("");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const completedTasks = filterOfficerTasks(query.data?.items || [], "COMPLETED");
  const resolvedCount = completedTasks.filter(
    (t) => t.status.toUpperCase() === "RESOLVED",
  ).length;
  const closedCount = completedTasks.filter(
    (t) => t.status.toUpperCase() === "CLOSED",
  ).length;

  const filteredByStatus = completedTasks.filter((task) => {
    const status = task.status.toUpperCase();
    if (statusFilter === "RESOLVED") return status === "RESOLVED";
    if (statusFilter === "CLOSED") return status === "CLOSED";
    return true;
  });

  const visibleTasks = searchOfficerTasks(filteredByStatus, search).sort(
    (a, b) =>
      Date.parse(b.resolvedAt || b.closedAt || b.createdAt) -
      Date.parse(a.resolvedAt || a.closedAt || a.createdAt),
  );

  return (
    <View
      style={[
        s.screen,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <OfficerHeader title="Lịch sử xử lý" />
      <FlatList
        data={visibleTasks}
        keyExtractor={(task) => task._id}
        contentContainerStyle={[
          s.content,
          { paddingBottom: Math.max(insets.bottom + 24, 32) },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: 14 }}>
            <OfficerEntrance>
              <OfficerCard accent style={{ overflow: "hidden", padding: 16 }}>
                <OfficerContours />
                <View style={s.row}>
                  <CheckCircle2 size={16} color={colors.primary} />
                  <Text style={[s.technical, { color: colors.primary }]}>
                    HỒ SƠ NGHIỆM THU HIỆN TRƯỜNG
                  </Text>
                </View>
                <Text style={[s.title, { color: colors.text }]}>
                  Thống kê nhiệm vụ hoàn thành
                </Text>
                <Text style={[s.body, { color: colors.textSecondary }]}>
                  Tra cứu lại các điểm rác đã dọn dẹp và xem đối chiếu ảnh minh
                  chứng Trước / Sau xử lý.
                </Text>
                <View style={s.row}>
                  <OfficerMetric
                    label="Tổng hoàn thành"
                    value={query.data ? completedTasks.length : "—"}
                    tone={colors.primary}
                  />
                  <OfficerMetric
                    label="Chờ nghiệm thu"
                    value={query.data ? resolvedCount : "—"}
                    tone={colors.cyan}
                  />
                  <OfficerMetric
                    label="Đã đóng hồ sơ"
                    value={query.data ? closedCount : "—"}
                    tone={colors.primary}
                  />
                </View>
              </OfficerCard>
            </OfficerEntrance>

            <View
              style={[
                s.row,
                {
                  backgroundColor: colors.elevated,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                },
              ]}
            >
              <Search size={18} color={colors.textMuted} />
              <TextInput
                accessibilityLabel="Tìm kiếm lịch sử nhiệm vụ đã hoàn thành"
                placeholder="Tìm theo tiêu đề, địa chỉ, mã hồ sơ..."
                placeholderTextColor={colors.textMuted}
                value={search}
                onChangeText={setSearch}
                style={[
                  s.grow,
                  { color: colors.text, minHeight: 46, fontSize: 13 },
                ]}
                clearButtonMode="while-editing"
              />
            </View>

            <View style={[s.row, { flexWrap: "wrap" }]}>
              {(
                [
                  ["ALL", `Tất cả · ${completedTasks.length}`],
                  ["RESOLVED", `Chờ nghiệm thu · ${resolvedCount}`],
                  ["CLOSED", `Đã nghiệm thu · ${closedCount}`],
                ] as const
              ).map(([key, label]) => {
                const selected = statusFilter === key;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setStatusFilter(key)}
                    style={{
                      minHeight: 38,
                      paddingHorizontal: 12,
                      borderRadius: 19,
                      justifyContent: "center",
                      backgroundColor: selected
                        ? colors.primary
                        : colors.elevated,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: selected ? "#07101F" : colors.textSecondary,
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        renderItem={({ item, index }) => {
          const isExpanded = expandedTaskId === item._id;
          const beforeUri = officerImage(item);
          const beforeFallback =
            item.fieldEvidence?.[0]?.originalUrl || item.mediaUrls?.[0];
          const beforeAt = item.fieldEvidence?.[0]?.capturedAt || item.createdAt;
          const afterEvidence = item.resolutionEvidence?.[0];
          const afterUri = afterEvidence?.url;
          const afterAt = afterEvidence?.capturedAt || item.resolvedAt;

          return (
            <OfficerEntrance delay={index * 30}>
              <View style={{ gap: 8 }}>
                <OfficerTaskCard
                  task={item}
                  compact
                  onPress={() =>
                    navigation.navigate("OfficerAlertDetail", { id: item._id })
                  }
                />
                <View style={[s.row, { justifyContent: "space-between" }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Xem ảnh đối chiếu trước và sau của ${officerReference(item)}`}
                    onPress={() =>
                      setExpandedTaskId((prev) =>
                        prev === item._id ? null : item._id,
                      )
                    }
                    style={[
                      s.row,
                      {
                        minHeight: 38,
                        paddingHorizontal: 12,
                        borderRadius: 10,
                        backgroundColor: isExpanded
                          ? colors.greenSoft
                          : colors.elevated,
                        borderWidth: 1,
                        borderColor: isExpanded
                          ? colors.primary + "50"
                          : colors.border,
                      },
                    ]}
                  >
                    <Images
                      size={15}
                      color={isExpanded ? colors.primary : colors.cyan}
                    />
                    <Text
                      style={[
                        s.meta,
                        {
                          fontWeight: "700",
                          color: isExpanded ? colors.primary : colors.text,
                        },
                      ]}
                    >
                      {isExpanded
                        ? "Ẩn ảnh đối chiếu Trước/Sau"
                        : "Xem ảnh đối chiếu Trước/Sau"}
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Xem biên bản nghiệm thu ${officerReference(item)}`}
                    onPress={() =>
                      navigation.navigate("OfficerResolutionSubmitted", {
                        id: item._id,
                      })
                    }
                    style={[
                      s.row,
                      {
                        minHeight: 38,
                        paddingHorizontal: 12,
                        borderRadius: 10,
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <FileCheck2 size={15} color={colors.primary} />
                    <Text
                      style={[
                        s.meta,
                        { fontWeight: "700", color: colors.primary },
                      ]}
                    >
                      Biên bản ›
                    </Text>
                  </Pressable>
                </View>

                {isExpanded && (
                  <View style={{ gap: 8 }}>
                    <OfficerEvidenceComparison
                      beforeUri={beforeUri}
                      beforeFallback={beforeFallback}
                      afterUri={afterUri}
                      beforeAt={beforeAt}
                      afterAt={afterAt}
                    />
                    {item.resolutionNotes ? (
                      <OfficerCard>
                        <View style={s.row}>
                          <OfficerBadge
                            label="BÁO CÁO KẾT QUẢ HIỆN TRƯỜNG"
                            color={colors.primary}
                          />
                          <Text
                            style={[
                              s.meta,
                              s.grow,
                              { color: colors.textMuted, textAlign: "right" },
                            ]}
                          >
                            {officerDate(item.resolvedAt)}
                          </Text>
                        </View>
                        <Text style={[s.body, { color: colors.textSecondary }]}>
                          {item.resolutionNotes}
                        </Text>
                        <Button
                          appearance="civic"
                          variant="outline"
                          title="MỞ CHI TIẾT HỒ SƠ"
                          icon={<Eye size={16} color={colors.primary} />}
                          onPress={() =>
                            navigation.navigate("OfficerAlertDetail", {
                              id: item._id,
                            })
                          }
                        />
                      </OfficerCard>
                    ) : null}
                  </View>
                )}
              </View>
            </OfficerEntrance>
          );
        }}
        ListEmptyComponent={
          <OfficerCard>
            {query.isLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={[s.body, { color: colors.textMuted }]}>
                {query.isError
                  ? "Không tải được lịch sử xử lý. Kéo xuống để thử lại."
                  : "Chưa có nhiệm vụ nào hoàn thành trong danh mục này."}
              </Text>
            )}
          </OfficerCard>
        }
      />
    </View>
  );
}
