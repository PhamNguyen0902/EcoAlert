import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert as NativeAlert,
} from "react-native";
import * as Location from "expo-location";
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
import { useAlerts, useCurrentShift, useEndShift, useStartShift } from "../../hooks/useAlerts";
import { useProfile } from "../../hooks/useAuth";
import { StatCard } from "../../components/ui/StatCard";
import { GlassCard } from "../../components/ui/GlassCard";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
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
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const { data: profile } = useProfile();
  const { data: alertsData, isLoading, refetch, isRefetching } = useAlerts(1, 50);
  const { data: currentShift, refetch: refetchShift } = useCurrentShift();
  const startShift = useStartShift();
  const endShift = useEndShift();
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
      await Promise.all([refetch(), refetchShift()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleShiftToggle = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        NativeAlert.alert("Location required", "Allow foreground location to record a shift boundary.");
        return;
      }
      // This is an explicit, one-time foreground event. The app never starts a
      // watcher or background task for shift tracking.
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const accuracyMeters = position.coords.accuracy;
      if (accuracyMeters === null || !Number.isFinite(accuracyMeters)) {
        NativeAlert.alert("Location unavailable", "A GPS accuracy value is required. Please retry outdoors.");
        return;
      }
      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters,
      };
      if (currentShift) {
        await endShift.mutateAsync(location);
        NativeAlert.alert("Shift ended", "Your shift end was recorded with this foreground GPS event.");
      } else {
        await startShift.mutateAsync(location);
        NativeAlert.alert("Shift started", "Your shift start was recorded with this foreground GPS event.");
      }
      await refetchShift();
    } catch (error: any) {
      NativeAlert.alert("Shift update failed", error?.response?.data?.message || error?.message || "Please retry with a clearer GPS signal.");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Sticky Top Header for Officer */}
      <View style={[styles.stickyHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTextContainer}>
          <Text style={[styles.greeting, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            {t("officer.officerDashboardTitle", "Officer Control Center")} {formatGreetingName(profile?.fullName)} 🛡️
          </Text>
          <Text style={[styles.subGreeting, { color: colors.textMuted }]}>{t("officer.environmentalResponse", "Environmental Command & Response")}</Text>
        </View>
        <TouchableOpacity style={[styles.refreshBtn, { backgroundColor: isDark ? "rgba(59, 130, 246, 0.25)" : "#DBEAFE" }]} onPress={onRefresh}>
          <RefreshCw size={18} color={isDark ? "#60A5FA" : colors.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing || isRefetching} onRefresh={onRefresh} tintColor={colors.secondary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Officer Response Desk Banner */}
        <GlassCard style={styles.banner} gradientColors={isDark ? ["rgba(30, 58, 138, 0.4)", "rgba(13, 148, 136, 0.25)"] : ["rgba(219, 234, 254, 0.9)", "rgba(204, 251, 241, 0.7)"]}>
          <View style={styles.bannerContent}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: isDark ? "#93C5FD" : "#1E40AF" }]}>{t("officer.responseDesk", "Response Desk")}</Text>
              <Text style={[styles.bannerSub, { color: colors.text }]}>
                {t("officer.responseDeskDesc", "Verify incoming citizen alerts, dispatch inspection teams, and log resolution updates.")}
              </Text>
            </View>
            <View style={[styles.bannerIcon, { backgroundColor: isDark ? "rgba(59, 130, 246, 0.3)" : "#DBEAFE" }]}>
              <ShieldAlert size={32} color={isDark ? "#60A5FA" : "#1D4ED8"} />
            </View>
          </View>
        </GlassCard>

        <Card style={[styles.shiftCard, { borderColor: currentShift ? "#14B8A6" : colors.border }]}>
          <View style={styles.shiftHeader}>
            <View>
              <Text style={[styles.shiftTitle, { color: colors.text }]}>Shift availability</Text>
              <Text style={[styles.shiftDescription, { color: colors.textMuted }]}>
                {currentShift ? `On shift since ${new Date(currentShift.startedAt).toLocaleTimeString()}` : "Off shift — start when you are ready to accept work."}
              </Text>
            </View>
            <Badge label={currentShift ? "ON SHIFT" : "OFF SHIFT"} type="custom" bgColor={currentShift ? "#CCFBF1" : (isDark ? "#334155" : "#E2E8F0")} textColor={currentShift ? "#0F766E" : colors.textMuted} />
          </View>
          <Text style={[styles.shiftPrivacy, { color: colors.textMuted }]}>GPS is recorded only when you tap Start Shift or End Shift. Background tracking is disabled.</Text>
          <TouchableOpacity disabled={startShift.isPending || endShift.isPending} onPress={handleShiftToggle} style={[styles.shiftButton, { backgroundColor: currentShift ? "#0F766E" : colors.secondary, opacity: startShift.isPending || endShift.isPending ? 0.65 : 1 }]}>
            <Text style={styles.shiftButtonText}>{startShift.isPending || endShift.isPending ? "Recording…" : currentShift ? "End Shift" : "Start Shift"}</Text>
          </TouchableOpacity>
        </Card>

        {/* Task Metrics Grid */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("officer.taskMetrics", "Task Metrics")}</Text>
        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <StatCard
              title={t("dashboard.pendingAlerts", "Pending")}
              value={officerStats.pendingVerification}
              icon={Clock}
              iconColor={isDark ? "#FDBA74" : "#EA580C"}
              iconBgColor={isDark ? "rgba(234, 88, 12, 0.25)" : "#FFEDD5"}
              style={styles.cardItem}
            />
            <StatCard
              title={t("officer.assignedToMe", "Assigned To Me")}
              value={officerStats.assignedToMe}
              icon={UserCheck}
              iconColor={isDark ? "#93C5FD" : "#2563EB"}
              iconBgColor={isDark ? "rgba(37, 99, 235, 0.25)" : "#DBEAFE"}
              style={styles.cardItem}
            />
          </View>
          <View style={styles.gridRow}>
            <StatCard
              title={t("officer.inProgress", "In Progress")}
              value={officerStats.inProgress}
              icon={RefreshCw}
              iconColor={isDark ? "#67E8F9" : "#0891B2"}
              iconBgColor={isDark ? "rgba(8, 145, 178, 0.25)" : "#CFFAFE"}
              style={styles.cardItem}
            />
            <StatCard
              title={t("officer.resolved", "Resolved")}
              value={officerStats.resolved}
              icon={CheckCircle}
              iconColor={isDark ? "#86EFAC" : "#16A34A"}
              iconBgColor={isDark ? "rgba(22, 163, 74, 0.25)" : "#DCFCE7"}
              style={styles.cardItem}
            />
          </View>
        </View>

        {/* Action Required Queue */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>{t("officer.actionRequiredQueue", "Action Required Queue")}</Text>
          <TouchableOpacity
            style={styles.viewAllBtn}
            onPress={() => navigation.navigate("TasksTab")}
          >
            <Text style={[styles.viewAllText, { color: isDark ? "#60A5FA" : colors.secondary }]}>{t("officer.viewAllQueue", "View All Queue")}</Text>
            <ChevronRight size={16} color={isDark ? "#60A5FA" : colors.secondary} />
          </TouchableOpacity>
        </View>

        {actionRequiredAlerts.length === 0 ? (
          <Card style={styles.emptyCard}>
            <CheckCircle size={36} color={isDark ? "#60A5FA" : colors.secondary} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>All Clear!</Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>There are no pending alerts requiring officer verification.</Text>
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
                    bgColor={isDark ? "rgba(255,255,255,0.1)" : "#F1F5F9"}
                    textColor={isDark ? colors.text : "#475569"}
                  />
                  <Badge label={alert.status || "PENDING"} type="status" />
                </View>
                <Text style={[styles.queueTitle, { color: colors.text }]} numberOfLines={1}>
                  {alert.title}
                </Text>
                <Text style={[styles.queueDesc, { color: colors.textMuted }]} numberOfLines={2}>
                  {alert.description}
                </Text>
                <View style={[styles.queueFooter, { borderTopColor: colors.border }]}>
                  <View style={styles.locationBox}>
                    <MapPin size={14} color={colors.textMuted} />
                    <Text style={[styles.locationText, { color: colors.textMuted }]} numberOfLines={1}>
                      {alert.address || "Unknown Location"}
                    </Text>
                  </View>
                  <View style={styles.actionPrompt}>
                    <Text style={[styles.actionPromptText, { color: isDark ? "#60A5FA" : colors.secondary }]}>Review & Respond</Text>
                    <ChevronRight size={16} color={isDark ? "#60A5FA" : colors.secondary} />
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
  bannerTitle: { fontSize: 18, fontWeight: "800", marginBottom: 4 },
  bannerSub: { fontSize: 13, lineHeight: 18 },
  bannerIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  shiftCard: { marginBottom: 16, padding: 16, borderWidth: 1 },
  shiftHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  shiftTitle: { fontSize: 16, fontWeight: "800" },
  shiftDescription: { fontSize: 12, marginTop: 4, maxWidth: 220 },
  shiftPrivacy: { fontSize: 11, lineHeight: 16, marginTop: 12 },
  shiftButton: { marginTop: 12, minHeight: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  shiftButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12, marginTop: 8 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  viewAllText: { fontSize: 14, fontWeight: "700" },
  viewAllBtn: { paddingVertical: 4, paddingLeft: 10 },
  grid: { gap: 12, marginBottom: 16 },
  gridRow: { flexDirection: "row", gap: 12 },
  cardItem: { flex: 1 },
  queueCard: { marginBottom: 12, padding: 16 },
  queueHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  queueTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  queueDesc: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  queueFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
  },
  locationBox: { flexDirection: "row", alignItems: "center", flex: 1, marginRight: 8 },
  locationText: { fontSize: 12, marginLeft: 4 },
  actionPrompt: { flexDirection: "row", alignItems: "center" },
  actionPromptText: { fontSize: 12, fontWeight: "700", marginRight: 2 },
  emptyCard: { alignItems: "center", paddingVertical: 32, marginTop: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  emptySub: { fontSize: 13, textAlign: "center" },
});

