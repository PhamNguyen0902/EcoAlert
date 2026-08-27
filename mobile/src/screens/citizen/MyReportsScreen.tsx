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
import { FileText, MapPin, ChevronRight, PlusCircle, Edit2, Trash2 } from "lucide-react-native";
import { useAlerts, useDeleteAlert } from "../../hooks/useAlerts";
import { useProfile } from "../../hooks/useAuth";
import { EditAlertModal } from "../../components/modals/EditAlertModal";
import { GlassCard } from "../../components/ui/GlassCard";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { format } from "date-fns";
import type { Alert as AlertItem } from "../../types";
import {
  getAiAnalysisState,
  getCategoryLabel,
  getSeverityLabel,
  getWorkflowStatusLabel,
} from "../../utils/aiAnalysis";

import { useOfflineSync } from "../../hooks/useOfflineSync";
import { CloudUpload, RefreshCw, WifiOff } from "lucide-react-native";

export const MyReportsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { language, t } = useLanguage();
  const { data: profile } = useProfile();
  const [editingAlert, setEditingAlert] = useState<AlertItem | null>(null);

  const { offlineDrafts, offlineCount, isSyncing, syncOfflineDrafts, isOffline } = useOfflineSync();
  const deleteAlertMutation = useDeleteAlert();

  const handleSyncOffline = async () => {
    const res = await syncOfflineDrafts();
    RNAlert.alert(
      t("modals.successTitle", "Đồng bộ hoàn tất"),
      `Đã gửi thành công ${res.successCount} báo cáo ngoại tuyến.${res.errorCount > 0 ? ` Có ${res.errorCount} báo cáo lỗi.` : ""}`,
    );
  };

  const filterParams = React.useMemo<Record<string, string>>(
    () => {
      const filters: Record<string, string> = {};
      if (typeof profile?._id === "string") {
        filters.reporterId = profile._id;
      }
      return filters;
    },
    [profile?._id]
  );

  const { data: alertsData, isLoading, refetch, isRefetching } = useAlerts(1, 50, filterParams);

  const alerts = alertsData?.items ?? [];


  const handleDelete = (item: AlertItem) => {
    RNAlert.alert(
      t("myReports.deleteTitle", "Delete Report"),
      t("myReports.deleteConfirmMsg", `Are you sure you want to delete report "${item.title}"?`),
      [
        { text: t("modals.cancel", "Cancel"), style: "cancel" },
        {
          text: t("btn.delete", "Delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAlertMutation.mutateAsync(item._id);
              RNAlert.alert(t("modals.successTitle", "Deleted"), t("myReports.deletedSuccessMsg", "Your report has been deleted."));
            } catch (err: any) {
              const msg = err.response?.data?.message || err.message || t("myReports.deleteFailed", "Failed to delete report.");
              RNAlert.alert(t("modals.saveError", "Error"), msg);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: AlertItem }) => {
    const normalizedStatus = item.status?.toUpperCase();
    const canEdit = normalizedStatus === "PENDING" || normalizedStatus === "AI_ANALYZING";
    const aiState = getAiAnalysisState(item);
    const aiLabel = aiState === "COMPLETED"
      ? getCategoryLabel(item.category, language)
      : aiState === "PENDING"
        ? t("aiAnalysis.analyzingShort", "AI: Analyzing...")
        : t("aiAnalysis.unavailableTitle", "AI analysis unavailable");

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => navigation.navigate("AlertDetail", { id: item._id })}
        accessibilityRole="button"
      >
        <GlassCard style={styles.card}>
          <View style={styles.header}>
            <Badge
              label={aiLabel}
              type="custom"
              bgColor={isDark ? "rgba(255,255,255,0.1)" : "#F1F5F9"}
              textColor={isDark ? colors.text : "#475569"}
            />
            <Badge label={getWorkflowStatusLabel(item.status, language)} statusValue={item.status} type="status" />
          </View>

          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[styles.desc, { color: colors.textMuted }]} numberOfLines={2}>
            {item.description}
          </Text>

          {aiState === "COMPLETED" ? (
            <View style={styles.aiMetaRow}>
              <Text style={[styles.aiMetaLabel, { color: colors.textMuted }]}>AI</Text>
              <Text style={[styles.aiMetaValue, { color: colors.text }]} numberOfLines={1}>
                {getCategoryLabel(item.category, language)} · {getSeverityLabel(item.severity, language)}
              </Text>
            </View>
          ) : null}

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <View style={styles.locationBox}>
              <MapPin size={14} color={colors.textMuted} />
              <Text style={[styles.locationText, { color: colors.textMuted }]} numberOfLines={1}>
                {item.address || t("report.selectedCoordinates", "Unknown location")}
              </Text>
            </View>
            <View style={styles.timeBox}>
              <Text style={[styles.timeText, { color: colors.textMuted }]}>
                {item.createdAt ? format(new Date(item.createdAt), "MMM d, HH:mm") : t("dashboard.recentAlerts", "Just now")}
              </Text>
              <ChevronRight size={16} color={colors.textMuted} />
            </View>
          </View>

          {canEdit ? (
            <View style={[styles.actionsRow, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => setEditingAlert(item)}
              >
                <Edit2 size={15} color={colors.primary} />
                <Text style={[styles.actionBtnText, { color: colors.primary }]}>{t("btn.edit", "Edit")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleDelete(item)}
              >
                <Trash2 size={15} color={isDark ? "#FCA5A5" : "#DC2626"} />
                <Text style={[styles.actionBtnText, { color: isDark ? "#FCA5A5" : "#DC2626" }]}>{t("btn.delete", "Delete")}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </GlassCard>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Sticky Header */}
      <View style={[styles.stickyHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t("tabs.myReports", "My Incident Reports")}</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
          {t("myReports.subtitle", "Track real-time resolution of reports submitted by you")}
        </Text>
      </View>

      <FlatList
        data={alerts}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading || isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          offlineCount > 0 ? (
            <Card
              style={[
                styles.offlineSyncBanner,
                {
                  backgroundColor: isDark ? "rgba(245,158,11,0.2)" : "#FEF3C7",
                  borderColor: isDark ? "rgba(245,158,11,0.4)" : "#F59E0B",
                },
              ]}
            >
              <View style={styles.offlineSyncHeader}>
                <CloudUpload size={20} color={isDark ? "#FBBF24" : "#D97706"} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.offlineSyncTitle, { color: isDark ? "#FDE047" : "#92400E" }]}>
                    Có {offlineCount} báo cáo sự cố đang chờ gửi
                  </Text>
                  <Text style={[styles.offlineSyncSub, { color: isDark ? "#FCD34D" : "#B45309" }]}>
                    Báo cáo được tạo khi ngoại tuyến và sẽ tự động gửi khi có kết nối mạng.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.syncBtn, { backgroundColor: colors.primary }]}
                onPress={() => void handleSyncOffline()}
                disabled={isSyncing || isOffline}
              >
                <RefreshCw size={14} color="#FFF" style={isSyncing ? styles.spinIcon : undefined} />
                <Text style={styles.syncBtnText}>
                  {isSyncing ? "Đang đồng bộ..." : isOffline ? "Chờ kết nối lại..." : "Đồng bộ ngay"}
                </Text>
              </TouchableOpacity>
            </Card>
          ) : null
        }
        ListEmptyComponent={
          !isLoading ? (
            <Card style={styles.emptyCard}>
              <FileText size={40} color={colors.textMuted} style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("myReports.emptyTitle", "No Reports Submitted")}</Text>
              <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                {t("myReports.emptySub", "You haven't reported any environmental issues yet. Help your community by creating an alert.")}
              </Text>
              <TouchableOpacity
                style={[styles.createBtn, { backgroundColor: colors.primary }]}
                onPress={() => navigation.navigate("ReportTab")}
                accessibilityRole="button"
              >
                <PlusCircle size={18} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.createBtnText}>{t("myReports.createBtn", "Report New Incident")}</Text>
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
  stickyHeader: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  headerTitle: { fontSize: 24, fontWeight: "800" },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  listContent: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 14 },
  card: { marginBottom: 14, padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  title: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  desc: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  aiMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  aiMetaLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  aiMetaValue: { flex: 1, fontSize: 12, fontWeight: "700" },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
  },
  locationBox: { flexDirection: "row", alignItems: "center", flex: 1, marginRight: 12 },
  locationText: { fontSize: 12, marginLeft: 4 },
  timeBox: { flexDirection: "row", alignItems: "center" },
  timeText: { fontSize: 12, marginRight: 2, fontWeight: "500" },
  actionsRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionBtnText: { fontSize: 12, fontWeight: "700" },
  emptyCard: { alignItems: "center", paddingVertical: 40, marginTop: 20 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginBottom: 6 },
  emptySub: { fontSize: 13, textAlign: "center", paddingHorizontal: 20, lineHeight: 18 },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  createBtnText: { fontSize: 14, fontWeight: "700", color: "#FFF" },
  offlineSyncBanner: { padding: 14, borderWidth: 1, marginBottom: 14 },
  offlineSyncHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  offlineSyncTitle: { fontSize: 14, fontWeight: "700" },
  offlineSyncSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  syncBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  syncBtnText: { fontSize: 13, fontWeight: "700", color: "#FFF" },
  spinIcon: { opacity: 0.8 },
});

