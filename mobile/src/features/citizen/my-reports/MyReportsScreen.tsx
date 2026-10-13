import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Alert as RNAlert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FileText, PlusCircle, Edit2, Trash2 } from "lucide-react-native";
import { useCitizenReports, useDeleteAlert } from "../../../hooks/useAlerts";
import { useProfile } from "../../auth/hooks/useAuth";
import { useUnreadNotificationCount } from "../../../hooks/useNotifications";
import { EditAlertModal } from "../../../components/modals/EditAlertModal";
import {
  CitizenSearch,
  CitizenStat,
  CitizenTopBar,
} from "../components/v2/CitizenUI";
import { CitizenReportProgress } from "../components/v2/CitizenReportProgress";
import {
  matchesReportSearch,
  reportTime,
  reportImage,
} from "../model/citizenPresentation";
import { CitizenReportCard } from "../components/CitizenReportCard";
import { EvidenceImageFrame } from "../../../shared/components/media/EvidenceImageFrame";
import {
  civicSpace as space,
  civicRadius as radius,
  civicType,
  civicStyles,
} from "../../../theme/civicDesign";
import { Card } from "../../../shared/components/ui/Card";
import { Badge } from "../../../shared/components/ui/Badge";
import { useCivicTheme } from "../../../theme/useCivicTheme";
import { useLanguage } from "../../../i18n/LanguageContext";
import type { Alert as AlertItem } from "../../../shared/types/index";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type {
  CitizenStackParamList,
  CitizenTabParamList,
} from "../../../navigation/types";
import {
  getAiAnalysisState,
  getCategoryLabel,
  getSeverityLabel,
  getWorkflowStatusLabel,
} from "../../../utils/aiAnalysis";

import { useOfflineSync } from "../../report/offline/useOfflineSync";
import { CloudUpload, RefreshCw } from "lucide-react-native";
import { matchesMyReportFilter } from "../model/citizenIncidents";
import type { MyReportFilter } from "../model/citizenIncidents";
// màn hình danh sách các báo cáo do chính người dân tạo và quản lý
export const MyReportsScreen: React.FC<
  BottomTabScreenProps<CitizenTabParamList, "MyReportsTab">
> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useCivicTheme();
  const { language, t } = useLanguage();
  const { data: profile } = useProfile();
  const unread = useUnreadNotificationCount();
  const [editingAlert, setEditingAlert] = useState<AlertItem | null>(null);
  const [filter, setFilter] = useState<MyReportFilter>("ALL");
  const [search, setSearch] = useState("");
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<string | null>(
    null,
  );

  const { offlineCount, isSyncing, syncOfflineDrafts, isOffline } =
    useOfflineSync();
  const deleteAlertMutation = useDeleteAlert();
  // đồng bộ toàn bộ bản nháp báo cáo đã lưu ngoại tuyến lên máy chủ khi có mạng
  const handleSyncOffline = async () => {
    const res = await syncOfflineDrafts();
    RNAlert.alert(
      t("modals.successTitle", "Đồng bộ hoàn tất"),
      `Đã gửi thành công ${res.successCount} báo cáo ngoại tuyến.${res.errorCount > 0 ? ` Có ${res.errorCount} báo cáo lỗi.` : ""}`,
    );
  };

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetching,
  } = useCitizenReports(profile?._id);
  const paginationBusy = Boolean(
    isFetching || isRefetching || isFetchingNextPage,
  );
  const alerts = useMemo(
    () =>
      profile
        ? Array.from(
            new Map(
              (data?.pages.flatMap((page) => page.items) ?? [])
                .filter((alert) => !alert.isDeleted)
                .map((alert) => [alert._id, alert]),
            ).values(),
          )
        : [],
    [data, profile],
  );
  // lọc danh sách báo cáo theo tab tất cả, đang xử lý hoặc đã xử lý
  const filteredAlerts = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          matchesMyReportFilter(alert, filter) &&
          matchesReportSearch(alert, search),
      ),
    [alerts, filter, search],
  );
  const counts = useMemo(
    () => ({
      ALL: alerts.length,
      PENDING: alerts.filter((alert) => matchesMyReportFilter(alert, "PENDING"))
        .length,
      PROCESSING: alerts.filter((alert) =>
        matchesMyReportFilter(alert, "PROCESSING"),
      ).length,
      RESOLVED: alerts.filter((alert) =>
        matchesMyReportFilter(alert, "RESOLVED"),
      ).length,
    }),
    [alerts],
  );
  const filterLabels: Record<MyReportFilter, string> =
    language === "vi"
      ? {
          ALL: "Tất cả",
          PENDING: "Chờ tiếp nhận",
          PROCESSING: "Đang xử lý",
          RESOLVED: "Đã xử lý",
        }
      : {
          ALL: "All",
          PENDING: "Pending",
          PROCESSING: "In progress",
          RESOLVED: "Resolved",
        };
  const handleDelete = (item: AlertItem) => {
    RNAlert.alert(
      t("myReports.deleteTitle", "Delete Report"),
      t(
        "myReports.deleteConfirmMsg",
        `Are you sure you want to delete report "${item.title}"?`,
      ),
      [
        { text: t("modals.cancel", "Cancel"), style: "cancel" },
        {
          text: t("btn.delete", "Delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAlertMutation.mutateAsync(item._id);
              RNAlert.alert(
                t("modals.successTitle", "Deleted"),
                t(
                  "myReports.deletedSuccessMsg",
                  "Your report has been deleted.",
                ),
              );
            } catch (err: any) {
              const msg =
                err.response?.data?.message ||
                err.message ||
                t("myReports.deleteFailed", "Failed to delete report.");
              RNAlert.alert(t("modals.saveError", "Error"), msg);
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: AlertItem }) => {
    const normalizedStatus = item.status?.toUpperCase();
    const canEdit =
      normalizedStatus === "PENDING" || normalizedStatus === "AI_ANALYZING";
    const aiState = getAiAnalysisState(item);
    const aiLabel =
      aiState === "COMPLETED"
        ? getCategoryLabel(item.category, language)
        : aiState === "PENDING"
          ? t("aiAnalysis.analyzingShort", "AI: Analyzing...")
          : t("aiAnalysis.unavailableTitle", "AI analysis unavailable");

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() =>
          navigation
            .getParent<NativeStackNavigationProp<CitizenStackParamList>>()
            ?.navigate("AlertDetail", { id: item._id })
        }
        accessibilityRole="button"
      >
        <CitizenReportCard
          compact
          title={item.title}
          address={
            item.address || t("report.selectedCoordinates", "Unknown location")
          }
          time={reportTime(item.createdAt)}
          imageUri={
            item.fieldEvidence?.[0]?.displayUrl ||
            item.fieldEvidence?.[0]?.originalUrl ||
            item.mediaUrls?.[0]
          }
          status={
            <Badge
              appearance="civic"
              label={getWorkflowStatusLabel(item.status, language)}
              statusValue={item.status}
              type="status"
            />
          }
        >
          <Text style={[civicType.meta, { color: colors.textMuted }]}>
            {aiLabel}
          </Text>
          <View style={styles.metadataRow}>
            <Text
              style={[civicType.meta, { color: colors.cyan }]}
              numberOfLines={1}
            >
              #{item._id.slice(-8).toUpperCase()}
            </Text>
            <Text
              style={[
                civicType.meta,
                { color: item.severity ? colors.warning : colors.textMuted },
              ]}
            >
              {item.severity
                ? getSeverityLabel(item.severity, language)
                : "Chờ đánh giá mức độ"}
            </Text>
          </View>
          <CitizenReportProgress status={item.status} />
          {["RESOLVED", "CLOSED"].includes(normalizedStatus) && (
            <View
              style={[styles.resolution, { backgroundColor: colors.greenSoft }]}
            >
              {(item.resolvedAt || item.closedAt) && (
                <Text style={[civicType.meta, { color: colors.primary }]}>
                  Hoàn thành · {reportTime(item.resolvedAt || item.closedAt)}
                </Text>
              )}
              {item.resolutionSummary && (
                <Text
                  numberOfLines={3}
                  style={[civicType.body, { color: colors.textSecondary }]}
                >
                  {item.resolutionSummary}
                </Text>
              )}
              {Boolean(item.resolutionEvidence?.length) && (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.actionBtn}
                  onPress={(event) => {
                    event.stopPropagation();
                    setExpandedEvidenceId((value) =>
                      value === item._id ? null : item._id,
                    );
                  }}
                  accessibilityState={{
                    expanded: expandedEvidenceId === item._id,
                  }}
                >
                  <Text style={[civicType.meta, { color: colors.primary }]}>
                    Xem ảnh trước / sau xử lý →
                  </Text>
                </TouchableOpacity>
              )}
              {expandedEvidenceId === item._id && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.evidenceRow}
                >
                  {reportImage(item) && (
                    <View style={styles.evidenceCell}>
                      <Text
                        style={[
                          civicType.meta,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Trước xử lý
                      </Text>
                      <EvidenceImageFrame
                        imageUri={reportImage(item)!}
                        style={styles.evidenceImage}
                        accessibilityLabel="Minh chứng trước xử lý"
                      />
                    </View>
                  )}
                  {item.resolutionEvidence?.map((evidence, index) => (
                    <View
                      key={evidence._id || `${evidence.url}-${index}`}
                      style={styles.evidenceCell}
                    >
                      <Text style={[civicType.meta, { color: colors.primary }]}>
                        Sau xử lý · {index + 1}
                      </Text>
                      <EvidenceImageFrame
                        imageUri={evidence.url}
                        style={styles.evidenceImage}
                        accessibilityLabel={`Minh chứng sau xử lý ${index + 1}`}
                      />
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          )}
          <Text style={[civicType.meta, { color: colors.cyan }]}>
            Xem chi tiết →
          </Text>
          {canEdit ? (
            <View
              style={[styles.actionsRow, { borderTopColor: colors.border }]}
            >
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.actionBtn}
                onPress={(event) => {
                  event.stopPropagation();
                  setEditingAlert(item);
                }}
              >
                <Edit2 size={15} color={colors.primary} />
                <Text style={[styles.actionBtnText, { color: colors.primary }]}>
                  {t("btn.edit", "Edit")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                accessibilityRole="button"
                onPress={(event) => {
                  event.stopPropagation();
                  handleDelete(item);
                }}
              >
                <Trash2 size={15} color={isDark ? "#FCA5A5" : "#DC2626"} />
                <Text
                  style={[
                    styles.actionBtnText,
                    { color: isDark ? "#FCA5A5" : "#DC2626" },
                  ]}
                >
                  {t("btn.delete", "Delete")}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </CitizenReportCard>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <CitizenTopBar
        title="Của tôi"
        user={profile}
        unreadCount={unread.data ?? 0}
        onNotifications={() =>
          navigation
            .getParent<NativeStackNavigationProp<CitizenStackParamList>>()
            ?.navigate("Notifications")
        }
        onProfile={() =>
          navigation
            .getParent<NativeStackNavigationProp<CitizenStackParamList>>()
            ?.navigate("Profile")
        }
      />
      <FlatList
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        data={filteredAlerts}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={Boolean(profile) && (isLoading || isRefetching)}
            onRefresh={() => {
              if (profile) void refetch();
            }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={[civicType.title, { color: colors.text }]}>
              {t("tabs.myReports", "Báo cáo của tôi")}
            </Text>
            <Text style={[civicType.body, { color: colors.textMuted }]}>
              Lịch sử ghi nhận và tiến độ xử lý
            </Text>
            <CitizenSearch
              value={search}
              onChangeText={setSearch}
              placeholder="Tìm theo tiêu đề, địa chỉ, mã số…"
            />
            <View style={styles.statsRow}>
              <CitizenStat
                label="Tổng gửi"
                value={
                  profile && data
                    ? (data.pages[0]?.total ?? alerts.length)
                    : "—"
                }
              />
              <CitizenStat
                label="Đang xử lý"
                value={profile && data ? counts.PROCESSING : "—"}
                tone="cyan"
              />
              <CitizenStat
                label="Đã xử lý"
                value={profile && data ? counts.RESOLVED : "—"}
              />
            </View>
            <Text style={[civicType.meta, { color: colors.textMuted }]}>
              Các nhóm trạng thái và kết quả tìm kiếm tính trên {alerts.length}{" "}
              báo cáo đã tải; chờ tiếp nhận được tách riêng.
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
            >
              {(
                ["ALL", "PENDING", "PROCESSING", "RESOLVED"] as MyReportFilter[]
              ).map((item) => (
                <TouchableOpacity
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === item }}
                  onPress={() => setFilter(item)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor:
                        filter === item ? colors.greenSoft : colors.elevated,
                      borderColor:
                        filter === item ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterLabel,
                      {
                        color:
                          filter === item ? colors.primary : colors.textMuted,
                      },
                    ]}
                  >
                    {filterLabels[item]} · {counts[item]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {hasNextPage && (
              <Text style={[civicType.meta, { color: colors.textMuted }]}>
                {language === "vi"
                  ? `Đã tải ${alerts.length}/${data?.pages[0]?.total ?? 0} báo cáo. Số đếm dựa trên báo cáo đã tải.`
                  : `Loaded ${alerts.length}/${data?.pages[0]?.total ?? 0} reports. Counts reflect loaded reports.`}
              </Text>
            )}
            {isOffline && (
              <Text
                accessibilityRole="alert"
                style={[civicType.meta, { color: colors.warning }]}
              >
                Bạn đang ngoại tuyến. Dữ liệu đã lưu vẫn có thể hiển thị.
              </Text>
            )}
            {profile && offlineCount > 0 ? (
              <Card
                appearance="civic"
                style={[
                  styles.offlineSyncBanner,
                  {
                    backgroundColor: isDark
                      ? "rgba(245,158,11,0.2)"
                      : "#FEF3C7",
                    borderColor: isDark ? "rgba(245,158,11,0.4)" : "#F59E0B",
                  },
                ]}
              >
                <View style={styles.offlineSyncHeader}>
                  <CloudUpload
                    size={20}
                    color={isDark ? "#FBBF24" : "#D97706"}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.offlineSyncTitle,
                        { color: isDark ? "#FDE047" : "#92400E" },
                      ]}
                    >
                      Có {offlineCount} báo cáo sự cố đang chờ gửi
                    </Text>
                    <Text
                      style={[
                        styles.offlineSyncSub,
                        { color: isDark ? "#FCD34D" : "#B45309" },
                      ]}
                    >
                      Báo cáo được tạo khi ngoại tuyến và sẽ tự động gửi khi có
                      kết nối mạng.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.syncBtn, { backgroundColor: colors.primary }]}
                  onPress={() => void handleSyncOffline()}
                  disabled={isSyncing || isOffline}
                  accessibilityRole="button"
                >
                  <RefreshCw
                    size={14}
                    color="#07101F"
                    style={isSyncing ? styles.spinIcon : undefined}
                  />
                  <Text style={styles.syncBtnText}>
                    {isSyncing
                      ? "Đang đồng bộ..."
                      : isOffline
                        ? "Chờ kết nối lại..."
                        : "Đồng bộ ngay"}
                  </Text>
                </TouchableOpacity>
              </Card>
            ) : null}
            {profile && isLoading && (
              <ActivityIndicator
                color={colors.primary}
                accessibilityLabel="Đang tải báo cáo"
              />
            )}
          </View>
        }
        ListFooterComponent={
          hasNextPage || isError ? (
            <TouchableOpacity
              accessibilityRole="button"
              disabled={paginationBusy}
              accessibilityState={{
                disabled: paginationBusy,
                busy: paginationBusy,
              }}
              onPress={() => {
                if (paginationBusy) return;
                if (isError) void refetch({ cancelRefetch: false });
                else void fetchNextPage({ cancelRefetch: false });
              }}
              style={[
                civicStyles.secondaryButton,
                { borderColor: colors.border },
              ]}
            >
              {isFetchingNextPage ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={[civicType.button, { color: colors.primary }]}>
                  {isError
                    ? language === "vi"
                      ? "Không tải được báo cáo · Thử lại"
                      : "Could not load reports · Retry"
                    : language === "vi"
                      ? "Tải thêm báo cáo"
                      : "Load more reports"}
                </Text>
              )}
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          !isLoading ? (
            <Card appearance="civic" style={styles.emptyCard}>
              <FileText
                size={40}
                color={colors.textMuted}
                style={{ marginBottom: 12 }}
              />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {isError
                  ? language === "vi"
                    ? "Chưa tải được báo cáo"
                    : "Reports unavailable"
                  : search.trim()
                    ? "Không tìm thấy báo cáo phù hợp"
                    : filter === "PENDING"
                      ? "Không có báo cáo chờ tiếp nhận"
                      : filter === "PROCESSING"
                        ? language === "vi"
                          ? "Không có báo cáo đang xử lý."
                          : "No reports in progress."
                        : filter === "RESOLVED"
                          ? language === "vi"
                            ? "Bạn chưa có báo cáo đã xử lý."
                            : "You have no resolved reports."
                          : !profile
                            ? language === "vi"
                              ? "Đăng nhập để xem báo cáo"
                              : "Sign in to view reports"
                            : language === "vi"
                              ? "Bạn chưa gửi báo cáo nào"
                              : "No reports submitted yet"}
              </Text>
              <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                {isError
                  ? language === "vi"
                    ? "Kiểm tra kết nối và bấm Thử lại bên dưới."
                    : "Check your connection and retry below."
                  : filter !== "ALL"
                    ? language === "vi"
                      ? "Chọn bộ lọc khác để xem các báo cáo còn lại."
                      : "Choose another filter to view other reports."
                    : language === "vi"
                      ? "Các báo cáo điểm rác bạn gửi sẽ xuất hiện tại đây."
                      : "Your waste incident reports will appear here."}
              </Text>
              <TouchableOpacity
                style={[styles.createBtn, { backgroundColor: colors.primary }]}
                onPress={() =>
                  profile
                    ? navigation.navigate("ReportTab")
                    : navigation
                        .getParent<
                          NativeStackNavigationProp<CitizenStackParamList>
                        >()
                        ?.navigate("Profile")
                }
                accessibilityRole="button"
              >
                <PlusCircle
                  size={18}
                  color="#07101F"
                  style={{ marginRight: space.sm }}
                />
                <Text style={styles.createBtnText}>
                  {profile
                    ? t("myReports.createBtn", "Báo cáo mới")
                    : "Đăng nhập"}
                </Text>
              </TouchableOpacity>
            </Card>
          ) : null
        }
      />

      <EditAlertModal
        visible={Boolean(editingAlert)}
        alert={editingAlert}
        onClose={() => setEditingAlert(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: space.lg, paddingBottom: space.page },
  listHeader: { gap: space.md, marginBottom: space.section },
  filters: { gap: space.sm },
  filterChip: {
    minHeight: 44,
    justifyContent: "center",
    borderRadius: radius.round,
    borderWidth: 1,
    paddingHorizontal: space.md,
  },
  filterLabel: { fontSize: 12, fontWeight: "700" },
  card: { marginBottom: space.lg },
  actionsRow: {
    flexDirection: "row",
    gap: space.lg,
    borderTopWidth: 1,
    paddingTop: space.xs,
  },
  actionBtn: {
    minHeight: 44,
    paddingHorizontal: space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  actionBtnText: { ...civicType.meta, fontWeight: "700" },
  emptyCard: { alignItems: "center", paddingVertical: space.page },
  emptyTitle: { ...civicType.section, marginBottom: space.sm },
  emptySub: { ...civicType.body, textAlign: "center" },
  createBtn: {
    ...civicStyles.primaryButton,
    marginTop: space.xl,
    alignSelf: "stretch",
  },
  createBtnText: { ...civicType.button, color: "#07101F" },
  offlineSyncBanner: { gap: space.md },
  offlineSyncHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
  },
  offlineSyncTitle: civicType.cardTitle,
  offlineSyncSub: { ...civicType.meta, marginTop: space.xs },
  syncBtn: civicStyles.primaryButton,
  syncBtnText: { ...civicType.button, color: "#07101F" },
  spinIcon: { opacity: 0.8 },
  statsRow: { flexDirection: "row", gap: 8 },
  metadataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  resolution: { padding: 10, borderRadius: 12, gap: 6 },
  evidenceRow: { gap: 10 },
  evidenceCell: { gap: 6, width: 120 },
  evidenceImage: {
    width: 120,
    height: 160,
    aspectRatio: undefined,
    borderRadius: 10,
  },
});
