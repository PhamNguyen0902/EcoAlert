import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  FileText,
  Clock,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  MapPin,
  ChevronRight,
  BarChart3,
  PieChart,
} from "lucide-react-native";
import { useAlerts } from "../../hooks/useAlerts";
import { useProfile } from "../../hooks/useAuth";
import { StatCard } from "../../components/ui/StatCard";
import { GlassCard } from "../../components/ui/GlassCard";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { DashboardSkeleton } from "../../components/ui/Skeleton";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { format } from "date-fns";
import type { Alert as AlertItem } from "../../types";

const CATEGORY_META = [
  { name: "Waste & Dumping", key: "illegal_dumping", color: "#16A34A" },
  { name: "Water Pollution", key: "water_pollution", color: "#3B82F6" },
  { name: "Air Pollution", key: "air_pollution", color: "#F59E0B" },
  { name: "Other Incidents", key: "other", color: "#64748B" },
] as const;

const KNOWN_CATEGORY_KEYS = new Set(["illegal_dumping", "water_pollution", "air_pollution"]);
const PROCESSING_STATUSES = new Set(["VERIFIED", "ASSIGNED", "IN_PROGRESS", "AI_ANALYZING"]);
const RESOLVED_STATUSES = new Set(["RESOLVED", "CLOSED"]);

function useAlertStats(alerts: AlertItem[]) {
  return useMemo(() => {
    const total = alerts.length;
    let pending = 0;
    let processing = 0;
    let resolved = 0;

    for (const a of alerts) {
      const status = a.status?.toUpperCase();
      if (status === "PENDING") pending++;
      else if (status && PROCESSING_STATUSES.has(status)) processing++;
      else if (status && RESOLVED_STATUSES.has(status)) resolved++;
    }

    const categoryCounts = CATEGORY_META.map((cat) => {
      const count = alerts.filter((a) => {
        const key = a.category?.toLowerCase();
        if (cat.key === "other") return !key || !KNOWN_CATEGORY_KEYS.has(key);
        return key === cat.key;
      }).length;
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      return { ...cat, count, percentage };
    });

    return { total, pending, processing, resolved, categoryCounts };
  }, [alerts]);
}

function formatGreetingName(fullName?: string): string {
  if (!fullName) return "Citizen";
  const name = fullName.trim();
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) {
    return parts[0];
  }
  return name;
}

export const CitizenDashboardScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const { data: alertsData, isLoading, refetch, isRefetching } = useAlerts(1, 50);
  const { data: profile } = useProfile();
  const [refreshing, setRefreshing] = useState(false);

  const alerts = alertsData?.items ?? [];
  const stats = useAlertStats(alerts);
  const recentAlerts = alerts.slice(0, 5);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading && !alertsData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <DashboardSkeleton />
      </View>
    );
  }


  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Sticky Top Header */}
      <View style={[styles.stickyHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTextContainer}>
          <Text style={[styles.greeting, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            {t("dashboard.welcome", "Hello")}, {formatGreetingName(profile?.fullName)} 👋
          </Text>
          <Text style={[styles.subGreeting, { color: colors.textMuted }]}>{t("dashboard.cityMonitorSub", "Environmental Pulse & Dashboard")}</Text>
        </View>
        <TouchableOpacity
          style={[styles.refreshButton, { backgroundColor: isDark ? "rgba(34,197,94,0.2)" : "#DCFCE7" }]}
          onPress={onRefresh}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Refresh dashboard"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <RefreshCw size={18} color="#16A34A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing || isRefetching} onRefresh={onRefresh} tintColor="#16A34A" />
        }
        showsVerticalScrollIndicator={false}
      >
        <GlassCard style={styles.heroBanner}>
          <View style={styles.heroContent}>
            <View style={styles.heroTextContainer}>
              <Text style={[styles.heroTitle, { color: isDark ? "#4ADE80" : "#166534" }]}>{t("dashboard.cityMonitorTitle", "City Incident Monitor")}</Text>
              <Text style={[styles.heroSubtitle, { color: colors.text }]}>
                {t("dashboard.cityMonitorSub", "Real-time monitoring and AI classification of environmental alerts across the metropolitan area.")}
              </Text>
            </View>
            <View style={[styles.heroIconBox, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.7)" }]}>
              <BarChart3 size={32} color="#16A34A" />
            </View>
          </View>
        </GlassCard>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("dashboard.overviewStats", "Overview Statistics")}</Text>
        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <StatCard
              title={t("dashboard.myTotalReports", "Total Reports")}
              value={stats.total}
              icon={FileText}
              iconColor="#3B82F6"
              iconBgColor={isDark ? "rgba(59,130,246,0.2)" : "#DBEAFE"}
              style={styles.cardItem}
            />
            <StatCard
              title={t("dashboard.pendingAlerts", "Pending")}
              value={stats.pending}
              icon={Clock}
              iconColor="#F59E0B"
              iconBgColor={isDark ? "rgba(245,158,11,0.2)" : "#FEF3C7"}
              style={styles.cardItem}
            />
          </View>
          <View style={styles.gridRow}>
            <StatCard
              title={t("dashboard.activeIncidents", "Processing")}
              value={stats.processing}
              icon={RefreshCw}
              iconColor="#8B5CF6"
              iconBgColor={isDark ? "rgba(139,92,246,0.2)" : "#EDE9FE"}
              style={styles.cardItem}
            />
            <StatCard
              title={t("dashboard.resolvedIncidents", "Resolved")}
              value={stats.resolved}
              icon={CheckCircle}
              iconColor="#16A34A"
              iconBgColor={isDark ? "rgba(22,163,74,0.2)" : "#DCFCE7"}
              style={styles.cardItem}
            />
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("dashboard.incidentsByCategory", "Incidents by Category")}</Text>
        {stats.total === 0 ? (
          <Card style={styles.categoryEmptyCard}>
            <PieChart size={28} color={colors.textMuted} />
            <Text style={[styles.categoryEmptyText, { color: colors.textMuted }]}>Category breakdown will appear once reports come in.</Text>
          </Card>
        ) : (
          <Card style={styles.categoryCard}>
            {stats.categoryCounts.map((cat, idx) => (
              <View
                key={cat.key}
                style={[styles.categoryRow, idx !== stats.categoryCounts.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              >
                <View style={styles.categoryHeader}>
                  <View style={styles.categoryNameContainer}>
                    <View style={[styles.colorDot, { backgroundColor: cat.color }]} />
                    <Text style={[styles.categoryName, { color: colors.text }]}>{cat.name}</Text>
                  </View>
                  <Text style={[styles.categoryValue, { color: colors.text }]}>
                    {cat.count} <Text style={[styles.percentageText, { color: colors.textMuted }]}>({cat.percentage}%)</Text>
                  </Text>
                </View>
                <View
                  style={[styles.progressBarBackground, { backgroundColor: colors.border }]}
                  accessibilityRole="progressbar"
                  accessibilityValue={{ min: 0, max: 100, now: cat.percentage }}
                >
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.max(cat.percentage, cat.count > 0 ? 4 : 0)}%`, backgroundColor: cat.color },
                    ]}
                  />
                </View>
              </View>
            ))}
          </Card>
        )}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>{t("dashboard.recentAlerts", "Recent Alerts")}</Text>
          {navigation && recentAlerts.length > 0 ? (
            <TouchableOpacity
              style={styles.viewAllBtn}
              onPress={() => navigation.navigate("ReportsTab")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
            >
              <Text style={[styles.viewAllText, { color: colors.primary }]}>View All</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {recentAlerts.length === 0 ? (
          <Card style={styles.emptyCard}>
            <AlertTriangle size={36} color={colors.textMuted} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Reports Found</Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>There are currently no environmental alerts reported.</Text>
            {navigation ? (
              <TouchableOpacity
                style={[styles.emptyCta, { backgroundColor: isDark ? "rgba(22, 163, 74, 0.25)" : colors.primaryLight }]}
                onPress={() => navigation.navigate("ReportTab")}
                accessibilityRole="button"
              >
                <Text style={[styles.emptyCtaText, { color: isDark ? "#4ADE80" : colors.primaryDark }]}>Report the first incident</Text>
              </TouchableOpacity>
            ) : null}
          </Card>
        ) : (
          recentAlerts.map((alert) => (
            <TouchableOpacity
              key={alert._id}
              activeOpacity={0.8}
              onPress={() => navigation?.navigate("AlertDetail", { id: alert._id })}
              accessibilityRole="button"
              accessibilityLabel={`${alert.title}, status ${alert.status || "pending"}`}
            >
              <GlassCard style={styles.recentCard}>
                <View style={styles.recentHeader}>
                  <Badge label={alert.category || "General"} type="custom" bgColor={isDark ? "rgba(255,255,255,0.1)" : "#F1F5F9"} textColor={isDark ? colors.text : "#475569"} />
                  <Badge label={alert.status || "PENDING"} type="status" />
                </View>
                <Text style={[styles.recentTitle, { color: colors.text }]} numberOfLines={1}>
                  {alert.title}
                </Text>
                <Text style={[styles.recentDesc, { color: colors.textMuted }]} numberOfLines={2}>
                  {alert.description}
                </Text>
                <View style={[styles.recentFooter, { borderTopColor: colors.border }]}>
                  <View style={styles.locationBox}>
                    <MapPin size={14} color={colors.textMuted} />
                    <Text style={[styles.locationText, { color: colors.textMuted }]} numberOfLines={1}>
                      {alert.address || "Unknown Location"}
                    </Text>
                  </View>
                  <View style={styles.timeBox}>
                    <Text style={[styles.timeText, { color: colors.textMuted }]}>
                      {alert.createdAt ? format(new Date(alert.createdAt), "MMM d, HH:mm") : "Just now"}
                    </Text>
                    <ChevronRight size={16} color={colors.textMuted} />
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
  greeting: { fontSize: 22, fontWeight: "800" },
  subGreeting: { fontSize: 13, marginTop: 2, fontWeight: "500" },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBanner: { marginBottom: 24, borderRadius: 24 },
  heroContent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroTextContainer: { flex: 1, paddingRight: 12 },
  heroTitle: { fontSize: 18, fontWeight: "800", marginBottom: 6 },
  heroSubtitle: { fontSize: 13, lineHeight: 18 },
  heroIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12, marginTop: 8 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 4,
  },
  viewAllText: { fontSize: 14, fontWeight: "700" },
  grid: { gap: 12, marginBottom: 16 },
  gridRow: { flexDirection: "row", gap: 12 },
  cardItem: { flex: 1 },
  categoryCard: { paddingVertical: 8, marginBottom: 16 },
  categoryEmptyCard: { alignItems: "center", paddingVertical: 28, marginBottom: 16, gap: 8 },
  categoryEmptyText: { fontSize: 13, textAlign: "center", paddingHorizontal: 24 },
  categoryRow: { paddingVertical: 12 },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  categoryNameContainer: { flexDirection: "row", alignItems: "center" },
  colorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  categoryName: { fontSize: 14, fontWeight: "600" },
  categoryValue: { fontSize: 14, fontWeight: "700" },
  percentageText: { fontSize: 13, fontWeight: "500" },
  progressBarBackground: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 4 },
  recentCard: { marginBottom: 12, padding: 16 },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  recentTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  recentDesc: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  recentFooter: {
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
  emptyCard: { alignItems: "center", paddingVertical: 32, marginTop: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  emptySub: { fontSize: 13, textAlign: "center" },
  emptyCta: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  emptyCtaText: { fontSize: 13, fontWeight: "700" },
});

