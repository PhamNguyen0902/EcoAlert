import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ShieldAlert,
  Clock,
  RefreshCw,
  CheckCircle,
  MapPin,
  ChevronRight,
  UserCheck,
} from "lucide-react-native";
import { useAlerts } from "../../hooks/useAlerts";
import { useProfile } from "../../hooks/useAuth";
import { StatCard } from "../../components/ui/StatCard";
import { GlassCard } from "../../components/ui/GlassCard";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { COLORS } from "../../utils/constants";
import type { Alert as AlertItem } from "../../types";

function formatGreetingName(fullName?: string): string {
  if (!fullName) return "";
  const name = fullName.trim();
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) {
    return parts[0];
  }
  return name;
}

export const OfficerDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { data: profile } = useProfile();
  const { data: alertsData, isLoading, refetch, isRefetching } = useAlerts(1, 50);
  const [refreshing, setRefreshing] = useState(false);

  const alerts = alertsData?.items ?? [];

  const officerStats = useMemo(() => {
    let pendingVerification = 0;
    let assignedToMe = 0;
    let inProgress = 0;
    let resolved = 0;

    for (const a of alerts) {
      const st = a.status?.toUpperCase();
      if (st === "PENDING" || st === "AI_ANALYZING") {
        pendingVerification++;
      } else if (st === "ASSIGNED" || st === "VERIFIED") {
        assignedToMe++;
      } else if (st === "IN_PROGRESS") {
        inProgress++;
      } else if (st === "RESOLVED" || st === "CLOSED") {
        resolved++;
      }
    }

    return { pendingVerification, assignedToMe, inProgress, resolved };
  }, [alerts]);

  const actionRequiredAlerts = useMemo(() => {
    return alerts
      .filter((a) => {
        const st = a.status?.toUpperCase();
        return st === "PENDING" || st === "VERIFIED" || st === "ASSIGNED" || st === "IN_PROGRESS";
      })
      .slice(0, 6);
  }, [alerts]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Sticky Top Header for Officer */}
      <View style={styles.stickyHeader}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.greeting} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            Officer {formatGreetingName(profile?.fullName)} 🛡️
          </Text>
          <Text style={styles.subGreeting}>Environmental Command & Response</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <RefreshCw size={18} color={COLORS.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing || isLoading} onRefresh={onRefresh} tintColor={COLORS.secondary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Officer Banner */}
        <GlassCard style={styles.banner} gradientColors={["rgba(59, 130, 246, 0.15)", "rgba(22, 163, 74, 0.1)"]}>
          <View style={styles.bannerContent}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Response Desk</Text>
              <Text style={styles.bannerSub}>
                Verify incoming citizen alerts, dispatch inspection teams, and log resolution updates.
              </Text>
            </View>
            <View style={styles.bannerIcon}>
              <ShieldAlert size={32} color={COLORS.secondary} />
            </View>
          </View>
        </GlassCard>

        {/* Statistics */}
        <Text style={styles.sectionTitle}>Task Metrics</Text>
        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <StatCard
              title="Pending Verification"
              value={officerStats.pendingVerification}
              icon={Clock}
              iconColor="#EA580C"
              iconBgColor="#FFEDD5"
              style={styles.cardItem}
            />
            <StatCard
              title="Assigned / Verified"
              value={officerStats.assignedToMe}
              icon={UserCheck}
              iconColor="#2563EB"
              iconBgColor="#DBEAFE"
              style={styles.cardItem}
            />
          </View>
          <View style={styles.gridRow}>
            <StatCard
              title="In Progress"
              value={officerStats.inProgress}
              icon={RefreshCw}
              iconColor="#0284C7"
              iconBgColor="#E0F2FE"
              style={styles.cardItem}
            />
            <StatCard
              title="Resolved Reports"
              value={officerStats.resolved}
              icon={CheckCircle}
              iconColor="#16A34A"
              iconBgColor="#DCFCE7"
              style={styles.cardItem}
            />
          </View>
        </View>

        {/* Action Queue List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Action Required Queue</Text>
          <TouchableOpacity onPress={() => navigation.navigate("OfficerTasksTab")}>
            <Text style={styles.viewAllText}>View All Queue</Text>
          </TouchableOpacity>
        </View>

        {actionRequiredAlerts.length === 0 ? (
          <Card style={styles.emptyCard}>
            <CheckCircle size={36} color={COLORS.secondary} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>All Clear!</Text>
            <Text style={styles.emptySub}>There are no pending alerts requiring officer verification.</Text>
          </Card>
        ) : (
          actionRequiredAlerts.map((alert) => (
            <TouchableOpacity
              key={alert._id}
              activeOpacity={0.8}
              onPress={() => navigation.navigate("OfficerAlertDetail", { id: alert._id })}
            >
              <GlassCard style={styles.queueCard}>
                <View style={styles.queueHeader}>
                  <Badge
                    label={alert.category?.toUpperCase().replace("_", " ") || "GENERAL"}
                    type="custom"
                    bgColor="#F1F5F9"
                    textColor="#475569"
                  />
                  <Badge label={alert.status || "PENDING"} type="status" />
                </View>
                <Text style={styles.queueTitle} numberOfLines={1}>
                  {alert.title}
                </Text>
                <Text style={styles.queueDesc} numberOfLines={2}>
                  {alert.description}
                </Text>
                <View style={styles.queueFooter}>
                  <View style={styles.locationBox}>
                    <MapPin size={14} color={COLORS.textMuted} />
                    <Text style={styles.locationText} numberOfLines={1}>
                      {alert.address || "Unknown Location"}
                    </Text>
                  </View>
                  <View style={styles.actionPrompt}>
                    <Text style={styles.actionPromptText}>Review & Respond</Text>
                    <ChevronRight size={16} color={COLORS.secondary} />
                  </View>
                </View>
              </GlassCard>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollView: { flex: 1 },
  contentContainer: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12 },
  stickyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  headerTextContainer: { flex: 1, marginRight: 12 },
  greeting: { fontSize: 22, fontWeight: "800", color: COLORS.text },
  subGreeting: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  banner: { marginBottom: 20, borderRadius: 24, padding: 18 },
  bannerContent: { flexDirection: "row", alignItems: "center" },
  bannerTitle: { fontSize: 18, fontWeight: "800", color: COLORS.secondary, marginBottom: 4 },
  bannerSub: { fontSize: 13, color: COLORS.text, lineHeight: 18 },
  bannerIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text, marginBottom: 12, marginTop: 8 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  viewAllText: { fontSize: 14, color: COLORS.secondary, fontWeight: "700" },
  grid: { gap: 12, marginBottom: 16 },
  gridRow: { flexDirection: "row", gap: 12 },
  cardItem: { flex: 1 },
  queueCard: { marginBottom: 12, padding: 16 },
  queueHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  queueTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginBottom: 4 },
  queueDesc: { fontSize: 13, color: COLORS.textMuted, lineHeight: 18, marginBottom: 12 },
  queueFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  locationBox: { flexDirection: "row", alignItems: "center", flex: 1, marginRight: 8 },
  locationText: { fontSize: 12, color: COLORS.textMuted, marginLeft: 4 },
  actionPrompt: { flexDirection: "row", alignItems: "center" },
  actionPromptText: { fontSize: 12, color: COLORS.secondary, fontWeight: "700", marginRight: 2 },
  emptyCard: { alignItems: "center", paddingVertical: 32, marginTop: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginBottom: 4 },
  emptySub: { fontSize: 13, color: COLORS.textMuted, textAlign: "center" },
});
