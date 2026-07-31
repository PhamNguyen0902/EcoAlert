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
import { format } from "date-fns";
import type { Alert as AlertItem } from "../../types";

export const MyReportsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { data: profile } = useProfile();
  const [editingAlert, setEditingAlert] = useState<AlertItem | null>(null);

  const deleteAlertMutation = useDeleteAlert();

  const filterParams = React.useMemo(
    () => (profile?._id ? { reporterId: profile._id } : {}),
    [profile?._id]
  );

  const { data: alertsData, isLoading, refetch, isRefetching } = useAlerts(1, 50, filterParams);

  const alerts = alertsData?.items ?? [];


  const handleDelete = (item: AlertItem) => {
    RNAlert.alert(
      "Delete Report",
      `Are you sure you want to delete report "${item.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAlertMutation.mutateAsync(item._id);
              RNAlert.alert("Deleted", "Your report has been deleted.");
            } catch (err: any) {
              const msg = err.response?.data?.message || err.message || "Failed to delete report.";
              RNAlert.alert("Error", msg);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: AlertItem }) => {
    const isPending = item.status?.toUpperCase() === "PENDING";

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => navigation.navigate("AlertDetail", { id: item._id })}
        accessibilityRole="button"
      >
        <GlassCard style={styles.card}>
          <View style={styles.header}>
            <Badge
              label={item.category?.toUpperCase().replace("_", " ") || "GENERAL"}
              type="custom"
              bgColor={isDark ? "rgba(255,255,255,0.1)" : "#F1F5F9"}
              textColor={isDark ? colors.text : "#475569"}
            />
            <Badge label={item.status || "PENDING"} type="status" />
          </View>

          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[styles.desc, { color: colors.textMuted }]} numberOfLines={2}>
            {item.description}
          </Text>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <View style={styles.locationBox}>
              <MapPin size={14} color={colors.textMuted} />
              <Text style={[styles.locationText, { color: colors.textMuted }]} numberOfLines={1}>
                {item.address || "Unknown location"}
              </Text>
            </View>
            <View style={styles.timeBox}>
              <Text style={[styles.timeText, { color: colors.textMuted }]}>
                {item.createdAt ? format(new Date(item.createdAt), "MMM d, HH:mm") : "Just now"}
              </Text>
              <ChevronRight size={16} color={colors.textMuted} />
            </View>
          </View>

          {isPending ? (
            <View style={[styles.actionsRow, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => setEditingAlert(item)}
              >
                <Edit2 size={15} color={colors.primary} />
                <Text style={[styles.actionBtnText, { color: colors.primary }]}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleDelete(item)}
              >
                <Trash2 size={15} color={isDark ? "#FCA5A5" : "#DC2626"} />
                <Text style={[styles.actionBtnText, { color: isDark ? "#FCA5A5" : "#DC2626" }]}>Delete</Text>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>My Incident Reports</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
          Track real-time resolution of reports submitted by you
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
        ListEmptyComponent={
          !isLoading ? (
            <Card style={styles.emptyCard}>
              <FileText size={40} color={colors.textMuted} style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Reports Submitted</Text>
              <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                You haven't reported any environmental issues yet. Help your community by creating an alert.
              </Text>
              <TouchableOpacity
                style={[styles.createBtn, { backgroundColor: colors.primary }]}
                onPress={() => navigation.navigate("ReportTab")}
                accessibilityRole="button"
              >
                <PlusCircle size={18} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.createBtnText}>Report New Incident</Text>
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
});

