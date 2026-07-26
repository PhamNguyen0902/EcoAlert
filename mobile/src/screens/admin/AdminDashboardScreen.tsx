import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FileText, CheckCircle, RefreshCw, Activity } from "lucide-react-native";
import { useAlerts } from "../../hooks/useAlerts";
import { StatCard } from "../../components/ui/StatCard";
import { GlassCard } from "../../components/ui/GlassCard";
import { Badge } from "../../components/ui/Badge";
import { COLORS } from "../../utils/constants";

export const AdminDashboardScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { data: alertsData, isLoading, refetch, isRefetching } = useAlerts(1, 100);

  const alerts = alertsData?.items ?? [];

  const adminStats = useMemo(() => {
    const total = alerts.length;
    let pending = 0;
    let resolved = 0;
    let critical = 0;

    for (const a of alerts) {
      const st = a.status?.toUpperCase();
      const sev = a.severity?.toUpperCase();
      if (st === "PENDING") pending++;
      if (st === "RESOLVED" || st === "CLOSED") resolved++;
      if (sev === "CRITICAL") critical++;
    }

    return { total, pending, resolved, critical };
  }, [alerts]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Sticky Admin Header */}
      <View style={styles.stickyHeader}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.greeting} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            Admin Control Center 🛡️
          </Text>
          <Text style={styles.subGreeting}>System Overview & Management</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => refetch()}>
          <RefreshCw size={18} color="#7C3AED" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={isLoading || isRefetching} onRefresh={refetch} tintColor="#7C3AED" />
        }
        showsVerticalScrollIndicator={false}
      >
        <GlassCard style={styles.banner} gradientColors={["rgba(124, 58, 237, 0.15)", "rgba(59, 130, 246, 0.1)"]}>
          <View style={styles.bannerContent}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Super Admin Portal</Text>
              <Text style={styles.bannerSub}>
                Monitor system metrics, user roles, incident routing, and platform audit logs.
              </Text>
            </View>
            <View style={styles.bannerIcon}>
              <Activity size={32} color="#7C3AED" />
            </View>
          </View>
        </GlassCard>

        <Text style={styles.sectionTitle}>System Metrics</Text>
        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <StatCard
              title="Total System Alerts"
              value={adminStats.total}
              icon={FileText}
              iconColor="#7C3AED"
              iconBgColor="#F3E8FF"
              style={styles.cardItem}
            />
            <StatCard
              title="Critical Priority"
              value={adminStats.critical}
              icon={Activity}
              iconColor="#DC2626"
              iconBgColor="#FEE2E2"
              style={styles.cardItem}
            />
          </View>
          <View style={styles.gridRow}>
            <StatCard
              title="Pending Action"
              value={adminStats.pending}
              icon={RefreshCw}
              iconColor="#EA580C"
              iconBgColor="#FFEDD5"
              style={styles.cardItem}
            />
            <StatCard
              title="Resolved Total"
              value={adminStats.resolved}
              icon={CheckCircle}
              iconColor="#16A34A"
              iconBgColor="#DCFCE7"
              style={styles.cardItem}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Recent System Activity</Text>
        {alerts.slice(0, 5).map((alert) => (
          <TouchableOpacity
            key={alert._id}
            activeOpacity={0.8}
            onPress={() => navigation?.navigate("AlertDetail", { id: alert._id })}
          >
            <GlassCard style={styles.activityCard}>
              <View style={styles.activityHeader}>
                <Badge label={alert.category?.toUpperCase() || "GENERAL"} type="custom" bgColor="#F3E8FF" textColor="#7C3AED" />
                <Badge label={alert.status || "PENDING"} type="status" />
              </View>
              <Text style={styles.activityTitle} numberOfLines={1}>
                {alert.title}
              </Text>
              <Text style={styles.activityDesc} numberOfLines={2}>
                {alert.description}
              </Text>
            </GlassCard>
          </TouchableOpacity>
        ))}
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
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
  },
  banner: { marginBottom: 20, borderRadius: 24, padding: 18 },
  bannerContent: { flexDirection: "row", alignItems: "center" },
  bannerTitle: { fontSize: 18, fontWeight: "800", color: "#7C3AED", marginBottom: 4 },
  bannerSub: { fontSize: 13, color: COLORS.text, lineHeight: 18 },
  bannerIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text, marginBottom: 12, marginTop: 8 },
  grid: { gap: 12, marginBottom: 16 },
  gridRow: { flexDirection: "row", gap: 12 },
  cardItem: { flex: 1 },
  activityCard: { marginBottom: 12, padding: 16 },
  activityHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  activityTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginBottom: 4 },
  activityDesc: { fontSize: 13, color: COLORS.textMuted, lineHeight: 18 },
});
