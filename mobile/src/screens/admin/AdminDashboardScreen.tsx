import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, Bot, FileText, CheckCircle, RefreshCw, Activity } from "lucide-react-native";
import { useAlerts } from "../../hooks/useAlerts";
import { StatCard } from "../../components/ui/StatCard";
import { GlassCard } from "../../components/ui/GlassCard";
import { Badge } from "../../components/ui/Badge";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";

export const AdminDashboardScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
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
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Sticky Admin Header */}
      <View style={[styles.stickyHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTextContainer}>
          <Text style={[styles.greeting, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            {t("admin.adminControlCenter", "Admin Control Center")} 🛡️
          </Text>
          <Text style={[styles.subGreeting, { color: colors.textMuted }]}>{t("admin.systemOverview", "System Overview & Management")}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.refreshBtn, { backgroundColor: isDark ? "rgba(124, 58, 237, 0.25)" : "#F3E8FF" }]} onPress={() => navigation?.getParent?.()?.navigate("Notifications")} accessibilityRole="button" accessibilityLabel={t("tabs.notifications", "Notifications")}>
            <Bell size={18} color="#7C3AED" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.refreshBtn, { backgroundColor: isDark ? "rgba(124, 58, 237, 0.25)" : "#F3E8FF" }]} onPress={() => navigation?.getParent?.()?.navigate("AdminAssistant")} accessibilityRole="button" accessibilityLabel={t("tabs.assistant", "Assistant")}>
            <Bot size={18} color="#7C3AED" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.refreshBtn, { backgroundColor: isDark ? "rgba(124, 58, 237, 0.25)" : "#F3E8FF" }]} onPress={() => refetch()} accessibilityRole="button" accessibilityLabel={t("common.refresh", "Refresh")}>
            <RefreshCw size={18} color="#7C3AED" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={isLoading || isRefetching} onRefresh={refetch} tintColor="#7C3AED" />
        }
        showsVerticalScrollIndicator={false}
      >
        <GlassCard style={styles.banner} gradientColors={isDark ? ["rgba(124, 58, 237, 0.35)", "rgba(59, 130, 246, 0.2)"] : ["rgba(124, 58, 237, 0.15)", "rgba(59, 130, 246, 0.1)"]}>
          <View style={styles.bannerContent}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>{t("admin.superAdminPortal", "Super Admin Portal")}</Text>
              <Text style={[styles.bannerSub, { color: colors.text }]}>
                {t("admin.adminPortalDesc", "Monitor system metrics, user roles, incident routing, and platform audit logs.")}
              </Text>
            </View>
            <View style={[styles.bannerIcon, { backgroundColor: isDark ? "rgba(124, 58, 237, 0.3)" : "#F3E8FF" }]}>
              <Activity size={32} color={isDark ? "#A78BFA" : "#7C3AED"} />
            </View>
          </View>
        </GlassCard>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("admin.systemMetrics", "System Metrics")}</Text>
        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <StatCard
              title={t("admin.totalSystemAlerts", "Total System Alerts")}
              value={adminStats.total}
              icon={FileText}
              iconColor={isDark ? "#A78BFA" : "#7C3AED"}
              iconBgColor={isDark ? "rgba(124, 58, 237, 0.25)" : "#F3E8FF"}
              style={styles.cardItem}
            />
            <StatCard
              title={t("admin.criticalIncidents", "Critical Priority")}
              value={adminStats.critical}
              icon={Activity}
              iconColor={isDark ? "#FCA5A5" : "#DC2626"}
              iconBgColor={isDark ? "rgba(220, 38, 38, 0.25)" : "#FEE2E2"}
              style={styles.cardItem}
            />
          </View>
          <View style={styles.gridRow}>
            <StatCard
              title={t("admin.pendingReview", "Pending Action")}
              value={adminStats.pending}
              icon={RefreshCw}
              iconColor={isDark ? "#FDBA74" : "#EA580C"}
              iconBgColor={isDark ? "rgba(234, 88, 12, 0.25)" : "#FFEDD5"}
              style={styles.cardItem}
            />
            <StatCard
              title={t("admin.resolvedIncidents", "Resolved Total")}
              value={adminStats.resolved}
              icon={CheckCircle}
              iconColor={isDark ? "#86EFAC" : "#16A34A"}
              iconBgColor={isDark ? "rgba(22, 163, 74, 0.25)" : "#DCFCE7"}
              style={styles.cardItem}
            />
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("admin.recentSystemActivity", "Recent System Activity")}</Text>

        {alerts.slice(0, 5).map((alert) => (
          <TouchableOpacity
            key={alert._id}
            activeOpacity={0.8}
            onPress={() => navigation?.navigate("AlertDetail", { id: alert._id })}
          >
            <GlassCard style={styles.activityCard}>
              <View style={styles.activityHeader}>
                <Badge label={alert.category?.toUpperCase() || "GENERAL"} type="custom" bgColor={isDark ? "rgba(124, 58, 237, 0.3)" : "#F3E8FF"} textColor={isDark ? "#C4B5FD" : "#7C3AED"} />
                <Badge label={alert.status || "PENDING"} type="status" />
              </View>
              <Text style={[styles.activityTitle, { color: colors.text }]} numberOfLines={1}>
                {alert.title}
              </Text>
              <Text style={[styles.activityDesc, { color: colors.textMuted }]} numberOfLines={2}>
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
  container: { flex: 1 },
  scrollView: { flex: 1 },
  contentContainer: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12 },
  stickyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    zIndex: 10,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  headerTextContainer: { flex: 1, marginRight: 12 },
  headerActions: { flexDirection: "row", gap: 7 },
  greeting: { fontSize: 22, fontWeight: "800" },
  subGreeting: { fontSize: 13, marginTop: 2 },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  banner: { marginBottom: 20, borderRadius: 24, padding: 18 },
  bannerContent: { flexDirection: "row", alignItems: "center" },
  bannerTitle: { fontSize: 18, fontWeight: "800", color: "#7C3AED", marginBottom: 4 },
  bannerSub: { fontSize: 13, lineHeight: 18 },
  bannerIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12, marginTop: 8 },
  grid: { gap: 12, marginBottom: 16 },
  gridRow: { flexDirection: "row", gap: 12 },
  cardItem: { flex: 1 },
  activityCard: { marginBottom: 12, padding: 16 },
  activityHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  activityTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  activityDesc: { fontSize: 13, lineHeight: 18 },
});

