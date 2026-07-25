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
import { useAlerts } from "../hooks/useAlerts";
import { useProfile } from "../hooks/useAuth";
import { StatCard } from "../components/ui/StatCard";
import { GlassCard } from "../components/ui/GlassCard";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { DashboardSkeleton } from "../components/ui/Skeleton";
import { COLORS } from "../utils/constants";
import { format } from "date-fns";
import type { Alert as AlertItem } from "../types";

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

export const DashboardScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
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

  if (isLoading && !isRefetching) {
    // Skeleton mirrors the real layout instead of a centered spinner —
    // the user sees the dashboard "shape" immediately, which reads as
    // faster even though the actual load time is unchanged.
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <DashboardSkeleton />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {profile?.fullName || "Citizen"} 👋</Text>
          <Text style={styles.subGreeting}>Environmental Pulse & Dashboard</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Refresh dashboard"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <RefreshCw size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <GlassCard style={styles.heroBanner} gradientColors={["rgba(22, 163, 74, 0.15)", "rgba(59, 130, 246, 0.1)"]}>
        <View style={styles.heroContent}>
          <View style={styles.heroTextContainer}>
            <Text style={styles.heroTitle}>City Incident Monitor</Text>
            <Text style={styles.heroSubtitle}>
              Real-time monitoring and AI classification of environmental alerts across the metropolitan area.
            </Text>
          </View>
          <View style={styles.heroIconBox}>
            <BarChart3 size={32} color={COLORS.primaryDark} />
          </View>
        </View>
      </GlassCard>

      <Text style={styles.sectionTitle}>Overview Statistics</Text>
      <View style={styles.grid}>
        <View style={styles.gridRow}>
          <StatCard
            title="Total Reports"
            value={stats.total}
            icon={FileText}
            iconColor="#475569"
            iconBgColor="#F1F5F9"
            delay={100}
            style={styles.cardItem}
          />
          <StatCard
            title="Pending"
            value={stats.pending}
            icon={Clock}
            iconColor="#EA580C"
            iconBgColor="#FFEDD5"
            delay={200}
            style={styles.cardItem}
          />
        </View>
        <View style={styles.gridRow}>
          <StatCard
            title="Processing"
            value={stats.processing}
            icon={RefreshCw}
            iconColor="#2563EB"
            iconBgColor="#DBEAFE"
            delay={300}
            style={styles.cardItem}
          />
          <StatCard
            title="Resolved"
            value={stats.resolved}
            icon={CheckCircle}
            iconColor="#16A34A"
            iconBgColor="#DCFCE7"
            delay={400}
            style={styles.cardItem}
          />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Incidents by Category</Text>
      {stats.total === 0 ? (
        <Card style={styles.categoryEmptyCard}>
          <PieChart size={28} color={COLORS.textMuted} />
          <Text style={styles.categoryEmptyText}>Category breakdown will appear once reports come in.</Text>
        </Card>
      ) : (
        <Card style={styles.categoryCard}>
          {stats.categoryCounts.map((cat, idx) => (
            <View
              key={cat.key}
              style={[styles.categoryRow, idx !== stats.categoryCounts.length - 1 && styles.borderBottom]}
            >
              <View style={styles.categoryHeader}>
                <View style={styles.categoryNameContainer}>
                  <View style={[styles.colorDot, { backgroundColor: cat.color }]} />
                  <Text style={styles.categoryName}>{cat.name}</Text>
                </View>
                <Text style={styles.categoryValue}>
                  {cat.count} <Text style={styles.percentageText}>({cat.percentage}%)</Text>
                </Text>
              </View>
              <View
                style={styles.progressBarBackground}
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
        <Text style={styles.sectionTitle}>Recent Incident Reports</Text>
        {navigation && recentAlerts.length > 0 ? (
          <TouchableOpacity
            onPress={() => navigation.navigate("ReportsTab")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
          >
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {recentAlerts.length === 0 ? (
        <Card style={styles.emptyCard}>
          <AlertTriangle size={36} color={COLORS.textMuted} style={{ marginBottom: 12 }} />
          <Text style={styles.emptyTitle}>No Reports Found</Text>
          <Text style={styles.emptySub}>There are currently no environmental alerts reported.</Text>
          {navigation ? (
            <TouchableOpacity
              style={styles.emptyCta}
              onPress={() => navigation.navigate("ReportTab")}
              accessibilityRole="button"
            >
              <Text style={styles.emptyCtaText}>Report the first incident</Text>
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
                <Badge label={alert.category || "General"} type="custom" bgColor="#F1F5F9" textColor="#475569" />
                <Badge label={alert.status || "PENDING"} type="status" />
              </View>
              <Text style={styles.recentTitle} numberOfLines={1}>
                {alert.title}
              </Text>
              <Text style={styles.recentDesc} numberOfLines={2}>
                {alert.description}
              </Text>
              <View style={styles.recentFooter}>
                <View style={styles.locationBox}>
                  <MapPin size={14} color={COLORS.textMuted} />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {alert.address || "Unknown Location"}
                  </Text>
                </View>
                <View style={styles.timeBox}>
                  <Text style={styles.timeText}>
                    {alert.createdAt ? format(new Date(alert.createdAt), "MMM d, HH:mm") : "Just now"}
                  </Text>
                  <ChevronRight size={16} color={COLORS.textMuted} />
                </View>
              </View>
            </GlassCard>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  contentContainer: { paddingHorizontal: 20, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 16,
  },
  greeting: { fontSize: 24, fontWeight: "800", color: COLORS.text },
  subGreeting: { fontSize: 14, color: COLORS.textMuted, marginTop: 2, fontWeight: "500" },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBanner: { marginBottom: 24, borderRadius: 24 },
  heroContent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroTextContainer: { flex: 1, paddingRight: 12 },
  heroTitle: { fontSize: 18, fontWeight: "800", color: COLORS.primaryDark, marginBottom: 6 },
  heroSubtitle: { fontSize: 13, color: COLORS.text, lineHeight: 18 },
  heroIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text, marginBottom: 12, marginTop: 8 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 4,
  },
  viewAllText: { fontSize: 14, color: COLORS.primary, fontWeight: "700" },
  grid: { gap: 12, marginBottom: 16 },
  gridRow: { flexDirection: "row", gap: 12 },
  cardItem: { flex: 1 },
  categoryCard: { paddingVertical: 8, marginBottom: 16 },
  categoryEmptyCard: { alignItems: "center", paddingVertical: 28, marginBottom: 16, gap: 8 },
  categoryEmptyText: { fontSize: 13, color: COLORS.textMuted, textAlign: "center", paddingHorizontal: 24 },
  categoryRow: { paddingVertical: 12 },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  categoryNameContainer: { flexDirection: "row", alignItems: "center" },
  colorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  categoryName: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  categoryValue: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  percentageText: { fontSize: 13, fontWeight: "500", color: COLORS.textMuted },
  progressBarBackground: { height: 8, backgroundColor: "#F1F5F9", borderRadius: 4, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 4 },
  recentCard: { marginBottom: 12, padding: 16 },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  recentTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginBottom: 4 },
  recentDesc: { fontSize: 13, color: COLORS.textMuted, lineHeight: 18, marginBottom: 12 },
  recentFooter: {
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
  emptyCard: { alignItems: "center", paddingVertical: 32, marginTop: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginBottom: 4 },
  emptySub: { fontSize: 13, color: COLORS.textMuted, textAlign: "center" },
  emptyCta: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
  },
  emptyCtaText: { fontSize: 13, fontWeight: "700", color: COLORS.primaryDark },
});