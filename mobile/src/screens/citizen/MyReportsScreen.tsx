import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FileText, MapPin, ChevronRight, PlusCircle } from "lucide-react-native";
import { useAlerts } from "../../hooks/useAlerts";
import { useProfile } from "../../hooks/useAuth";
import { GlassCard } from "../../components/ui/GlassCard";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { COLORS } from "../../utils/constants";
import { format } from "date-fns";
import type { Alert as AlertItem } from "../../types";

export const MyReportsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { data: profile } = useProfile();
  
  const { data: alertsData, isLoading, refetch, isRefetching } = useAlerts(1, 50, {
    reporterId: profile?._id || "",
  });

  const alerts = alertsData?.items ?? [];

  const onRefresh = async () => {
    await refetch();
  };

  const renderItem = ({ item }: { item: AlertItem }) => (
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
            bgColor="#F1F5F9"
            textColor="#475569"
          />
          <Badge label={item.status || "PENDING"} type="status" />
        </View>

        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.desc} numberOfLines={2}>
          {item.description}
        </Text>

        <View style={styles.footer}>
          <View style={styles.locationBox}>
            <MapPin size={14} color={COLORS.textMuted} />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.address || "Unknown location"}
            </Text>
          </View>
          <View style={styles.timeBox}>
            <Text style={styles.timeText}>
              {item.createdAt ? format(new Date(item.createdAt), "MMM d, HH:mm") : "Just now"}
            </Text>
            <ChevronRight size={16} color={COLORS.textMuted} />
          </View>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Sticky Header */}
      <View style={styles.stickyHeader}>
        <Text style={styles.headerTitle}>My Incident Reports</Text>
        <Text style={styles.headerSubtitle}>
          Track real-time resolution of reports submitted by you
        </Text>
      </View>

      <FlatList
        data={alerts}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading || isRefetching} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <Card style={styles.emptyCard}>
              <FileText size={40} color={COLORS.textMuted} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>No Reports Submitted</Text>
              <Text style={styles.emptySub}>
                You haven't reported any environmental issues yet. Help your community by creating an alert.
              </Text>
              <TouchableOpacity
                style={styles.createBtn}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  stickyHeader: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    zIndex: 10,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: COLORS.text },
  headerSubtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  listContent: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 14 },
  card: { marginBottom: 14, padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  title: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginBottom: 4 },
  desc: { fontSize: 13, color: COLORS.textMuted, lineHeight: 18, marginBottom: 12 },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  locationBox: { flexDirection: "row", alignItems: "center", flex: 1, marginRight: 12 },
  locationText: { fontSize: 12, color: COLORS.textMuted, marginLeft: 4 },
  timeBox: { flexDirection: "row", alignItems: "center" },
  timeText: { fontSize: 12, color: COLORS.textMuted, marginRight: 2, fontWeight: "500" },
  emptyCard: { alignItems: "center", paddingVertical: 40, marginTop: 20 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text, marginBottom: 6 },
  emptySub: { fontSize: 13, color: COLORS.textMuted, textAlign: "center", paddingHorizontal: 20, lineHeight: 18 },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
  },
  createBtnText: { fontSize: 14, fontWeight: "700", color: "#FFF" },
});
