import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert as RNAlert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FileText, PlusCircle, Edit2, Trash2 } from "lucide-react-native";
import { useAlerts, useDeleteAlert } from "../../hooks/useAlerts";
import { useProfile } from "../../hooks/useAuth";
import { EditAlertModal } from "../../components/modals/EditAlertModal";
import { CitizenHeader } from "../../components/citizen/CitizenHeader";
import { CitizenReportCard } from "../../components/citizen/CitizenReportCard";
import {
  civicSpace as space,
  civicRadius as radius,
  civicType,
  civicStyles,
} from "../../theme/civicDesign";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { useCivicTheme } from "../../theme/useCivicTheme";
import { useLanguage } from "../../context/LanguageContext";
import { format } from "date-fns";
import type { Alert as AlertItem } from "../../types";
import {
  getAiAnalysisState,
  getCategoryLabel,
  getWorkflowStatusLabel,
} from "../../utils/aiAnalysis";

import { useOfflineSync } from "../../hooks/useOfflineSync";
import { CloudUpload, RefreshCw, WifiOff } from "lucide-react-native";

export const MyReportsScreen: React.FC<{ navigation: any }> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useCivicTheme();
  const { language, t } = useLanguage();
  const { data: profile } = useProfile();
  const [editingAlert, setEditingAlert] = useState<AlertItem | null>(null);

  const {
    offlineDrafts,
    offlineCount,
    isSyncing,
    syncOfflineDrafts,
    isOffline,
  } = useOfflineSync();
  const deleteAlertMutation = useDeleteAlert();

  const handleSyncOffline = async () => {
    const res = await syncOfflineDrafts();
    RNAlert.alert(
      t("modals.successTitle", "Đồng bộ hoàn tất"),
      `Đã gửi thành công ${res.successCount} báo cáo ngoại tuyến.${res.errorCount > 0 ? ` Có ${res.errorCount} báo cáo lỗi.` : ""}`,
    );
  };

  const filterParams = React.useMemo<Record<string, string>>(() => {
    const filters: Record<string, string> = {};
    if (typeof profile?._id === "string") {
      filters.reporterId = profile._id;
    }
    return filters;
  }, [profile?._id]);

  const {
    data: alertsData,
    isLoading,
    refetch,
    isRefetching,
  } = useAlerts(1, 50, filterParams);

  const alerts = alertsData?.items ?? [];

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
        onPress={() => navigation.navigate("AlertDetail", { id: item._id })}
        accessibilityRole="button"
      >
        <CitizenReportCard
          title={item.title}
          address={
            item.address || t("report.selectedCoordinates", "Unknown location")
          }
          time={
            item.createdAt
              ? format(new Date(item.createdAt), "MMM d, HH:mm")
              : t("dashboard.recentAlerts", "Just now")
          }
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
          {canEdit ? (
            <View
              style={[styles.actionsRow, { borderTopColor: colors.border }]}
            >
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.actionBtn}
                onPress={() => setEditingAlert(item)}
              >
                <Edit2 size={15} color={colors.primary} />
                <Text style={[styles.actionBtnText, { color: colors.primary }]}>
                  {t("btn.edit", "Edit")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                accessibilityRole="button"
                onPress={() => handleDelete(item)}
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
      <CitizenHeader
        avatarLabel={profile?.fullName?.charAt(0).toUpperCase() || "EA"}
      />
      <FlatList
        data={alerts}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading || isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={[civicType.title, { color: colors.text }]}>
              {t("tabs.myReports", "Báo cáo của tôi")}
            </Text>
            <Text style={[civicType.body, { color: colors.textMuted }]}>
              {t(
                "myReports.subtitle",
                "Theo dõi tiến trình xử lý báo cáo của bạn.",
              )}
            </Text>
            <View
              style={[styles.countChip, { backgroundColor: colors.greenSoft }]}
            >
              <Text style={[civicType.meta, { color: colors.primary }]}>
                {language === "vi" ? "Tất cả" : "All"} ·{" "}
                {alertsData?.total ?? alerts.length}
              </Text>
            </View>
            {offlineCount > 0 ? (
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
          </View>
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
                {t("myReports.emptyTitle", "No Reports Submitted")}
              </Text>
              <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                {t(
                  "myReports.emptySub",
                  "You haven't reported any environmental issues yet. Help your community by creating an alert.",
                )}
              </Text>
              <TouchableOpacity
                style={[styles.createBtn, { backgroundColor: colors.primary }]}
                onPress={() => navigation.navigate("ReportTab")}
                accessibilityRole="button"
              >
                <PlusCircle
                  size={18}
                  color="#FFF"
                  style={{ marginRight: space.sm }}
                />
                <Text style={styles.createBtnText}>
                  {t("myReports.createBtn", "Report New Incident")}
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
  countChip: {
    alignSelf: "flex-start",
    borderRadius: radius.chip,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
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
});
