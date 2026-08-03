import React, { useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Bell,
  Bot,
  Camera,
  CheckCircle2,
  ChevronRight,
  FileText,
  MapPin,
  Navigation,
  Plus,
  Sparkles,
  User as UserIcon,
} from "lucide-react-native";
import { formatDistanceToNow } from "date-fns";
import { enUS, vi } from "date-fns/locale";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { Alert as AlertItem } from "../../types";
import type { CitizenStackParamList, CitizenTabParamList } from "../../navigation/types";
import { useAlerts } from "../../hooks/useAlerts";
import { useProfile } from "../../hooks/useAuth";
import { useDashboardLocation } from "../../hooks/useDashboardLocation";
import { useUnreadNotificationCount } from "../../hooks/useNotifications";
import { useWeather } from "../../hooks/useWeather";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { WeatherCard } from "../../components/weather/WeatherCard";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  getAiAnalysisState,
  getCategoryLabel,
  getSeverityLabel,
  getWorkflowStatusLabel,
} from "../../utils/aiAnalysis";
import { DARK_STATUS_COLORS, SEVERITY_COLORS, STATUS_COLORS } from "../../utils/constants";

type Props = BottomTabScreenProps<CitizenTabParamList, "DashboardTab">;

const PROCESSING_STATUSES = new Set(["PENDING", "AI_ANALYZING", "VERIFIED", "ASSIGNED", "IN_PROGRESS"]);
const COMPLETED_STATUSES = new Set(["RESOLVED", "CLOSED"]);
const INACTIVE_STATUSES = new Set(["RESOLVED", "CLOSED", "REJECTED"]);

const displayName = (fullName?: string): string => {
  const normalized = fullName?.trim();
  if (!normalized) return "EcoAlert Citizen";
  const parts = normalized.split(/\s+/);
  return parts.at(-1) ?? normalized;
};

export const CitizenDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { language } = useLanguage();
  const profile = useProfile();
  const alertsQuery = useAlerts(1, 100);
  const unreadQuery = useUnreadNotificationCount(Boolean(profile.data));
  const [refreshing, setRefreshing] = useState(false);

  const alerts = alertsQuery.data?.items ?? [];
  const { location, isResolvingDeviceLocation } = useDashboardLocation(alerts[0]);
  const weatherQuery = useWeather(
    location.latitude,
    location.longitude,
    !alertsQuery.isLoading && !isResolvingDeviceLocation,
  );

  const copy = language === "vi"
    ? {
        greeting: "Xin chào",
        greetingBody: "Hãy cùng giữ thành phố xanh hôm nay.",
        reportTitle: "Báo cáo sự cố môi trường",
        reportBody: "Phát hiện vấn đề? Chụp ảnh và gửi ngay cho EcoAlert.",
        reportButton: "Báo cáo sự cố",
        photo: "Ảnh",
        gps: "GPS",
        aiAnalysis: "AI phân tích",
        statsTitle: "Báo cáo của bạn",
        total: "Tổng cộng",
        processing: "Đang xử lý",
        completed: "Hoàn thành",
        active: "Đang được xử lý",
        recent: "Báo cáo gần đây",
        viewAll: "Xem tất cả",
        empty: "Bạn chưa có báo cáo nào.",
        emptyButton: "Tạo báo cáo đầu tiên",
        aiBody: "Hỏi về báo cáo, trạng thái hoặc cách sử dụng EcoAlert.",
        askAi: "Hỏi EcoAlert AI",
        aiPending: "AI đang phân tích…",
        unknownLocation: "Chưa có địa chỉ",
        notifications: "Mở thông báo",
        profile: "Mở hồ sơ",
      }
    : {
        greeting: "Hello",
        greetingBody: "Let’s help keep the city green today.",
        reportTitle: "Report an environmental incident",
        reportBody: "Spotted a problem? Take a photo and send it to EcoAlert.",
        reportButton: "Report incident",
        photo: "Photo",
        gps: "GPS",
        aiAnalysis: "AI analysis",
        statsTitle: "Your reports",
        total: "Total",
        processing: "Processing",
        completed: "Completed",
        active: "Being handled",
        recent: "Recent reports",
        viewAll: "View all",
        empty: "You have not submitted a report yet.",
        emptyButton: "Create your first report",
        aiBody: "Ask about reports, statuses, or how to use EcoAlert.",
        askAi: "Ask EcoAlert AI",
        aiPending: "AI is analyzing…",
        unknownLocation: "Address unavailable",
        notifications: "Open notifications",
        profile: "Open profile",
      };

  const stats = useMemo(() => {
    let processing = 0;
    let completed = 0;
    for (const alert of alerts) {
      const status = alert.status?.toUpperCase();
      if (PROCESSING_STATUSES.has(status)) processing += 1;
      if (COMPLETED_STATUSES.has(status)) completed += 1;
    }
    return {
      total: alertsQuery.data?.total ?? alerts.length,
      processing,
      completed,
    };
  }, [alerts, alertsQuery.data?.total]);

  const activeReports = useMemo(() => {
    const active = alerts.filter((alert) => !INACTIVE_STATUSES.has(alert.status?.toUpperCase()));
    return (active.length > 0 ? active : alerts).slice(0, 3);
  }, [alerts]);

  const openAlert = (id: string) => {
    navigation
      .getParent<NativeStackNavigationProp<CitizenStackParamList>>()
      ?.navigate("AlertDetail", { id });
  };

  const openNotifications = () => {
    navigation
      .getParent<NativeStackNavigationProp<CitizenStackParamList>>()
      ?.navigate("Notifications");
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        alertsQuery.refetch(),
        unreadQuery.refetch(),
        weatherQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const renderReport = (alert: AlertItem) => {
    const aiState = getAiAnalysisState(alert);
    const statusKey = alert.status?.toUpperCase() || "PENDING";
    const statusPalette = isDark ? DARK_STATUS_COLORS : STATUS_COLORS;
    const statusColor = statusPalette[statusKey] ?? statusPalette.PENDING;
    const severity = alert.severity ? getSeverityLabel(alert.severity) : null;
    const severityColors = alert.severity ? SEVERITY_COLORS[alert.severity] : undefined;

    return (
      <TouchableOpacity
        key={alert._id}
        activeOpacity={0.74}
        onPress={() => openAlert(alert._id)}
        accessibilityRole="button"
        accessibilityLabel={`${alert.title}. ${getWorkflowStatusLabel(alert.status, language)}`}
      >
        <Card style={styles.reportCard}>
          <View style={styles.reportTopRow}>
            <Badge
              label={getWorkflowStatusLabel(alert.status, language)}
              type="custom"
              bgColor={statusColor.bg}
              textColor={statusColor.text}
            />
            {aiState === "COMPLETED" && severity && severityColors ? (
              <Badge label={severity} type="custom" bgColor={severityColors.bg} textColor={severityColors.text} />
            ) : null}
          </View>
          <View style={styles.reportTitleRow}>
            <Text style={[styles.reportTitle, { color: colors.text }]} numberOfLines={1}>{alert.title}</Text>
            <ChevronRight size={18} color={colors.textMuted} />
          </View>
          {aiState === "COMPLETED" ? (
            <View style={styles.aiMetaRow}>
              <Sparkles size={13} color={colors.secondary} />
              <Text style={[styles.aiMetaText, { color: colors.secondary }]} numberOfLines={1}>
                {getCategoryLabel(alert.category, language)}
              </Text>
            </View>
          ) : (
            <View style={styles.aiMetaRow}>
              <Sparkles size={13} color={colors.textMuted} />
              <Text style={[styles.aiMetaText, { color: colors.textMuted }]}>{copy.aiPending}</Text>
            </View>
          )}
          <View style={styles.reportFooter}>
            <View style={styles.reportLocation}>
              <MapPin size={13} color={colors.textMuted} />
              <Text style={[styles.reportMetaText, { color: colors.textMuted }]} numberOfLines={1}>
                {alert.address || copy.unknownLocation}
              </Text>
            </View>
            <Text style={[styles.relativeTime, { color: colors.textMuted }]}>
              {formatDistanceToNow(new Date(alert.createdAt), {
                addSuffix: true,
                locale: language === "vi" ? vi : enUS,
              })}
            </Text>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.brandRow}>
          <View style={[styles.brandMark, { backgroundColor: isDark ? "rgba(34,197,94,0.17)" : colors.primaryLight }]}>
            <Navigation size={20} color={colors.primary} fill={colors.primary} />
          </View>
          <Text style={[styles.brandText, { color: colors.text }]}>EcoAlert</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={openNotifications}
            style={[styles.headerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={copy.notifications}
          >
            <Bell size={19} color={colors.text} />
            {(unreadQuery.data ?? 0) > 0 ? (
              <View style={[styles.unreadBadge, { backgroundColor: colors.destructive }]}>
                <Text style={styles.unreadText}>{Math.min(unreadQuery.data ?? 0, 9)}{(unreadQuery.data ?? 0) > 9 ? "+" : ""}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate("ProfileTab")}
            style={[styles.avatarButton, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={copy.profile}
          >
            {profile.data?.fullName ? (
              <Text style={[styles.avatarText, { color: isDark ? "#86EFAC" : colors.primaryDark }]}>
                {profile.data.fullName.trim().charAt(0).toUpperCase()}
              </Text>
            ) : (
              <UserIcon size={19} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <View style={styles.greetingBlock}>
          <Text style={[styles.greeting, { color: colors.text }]} numberOfLines={1}>
            {copy.greeting}, {displayName(profile.data?.fullName)} 👋
          </Text>
          <Text style={[styles.greetingBody, { color: colors.textMuted }]}>{copy.greetingBody}</Text>
          <View style={styles.currentLocationRow}>
            <MapPin size={14} color={colors.primary} />
            <Text style={[styles.currentLocationText, { color: colors.textMuted }]} numberOfLines={1}>{location.label}</Text>
          </View>
        </View>

        <WeatherCard
          weather={weatherQuery.data}
          locationLabel={location.label}
          isLoading={weatherQuery.isLoading || isResolvingDeviceLocation}
          isError={weatherQuery.isError}
          isCached={Boolean(weatherQuery.data && !weatherQuery.isFetchedAfterMount)}
          onRetry={() => weatherQuery.refetch()}
        />

        <View style={[styles.reportCta, { backgroundColor: isDark ? "#0D5132" : "#15803D" }]}>
          <View style={styles.ctaHeader}>
            <View style={styles.ctaCopy}>
              <Text style={styles.ctaTitle}>{copy.reportTitle}</Text>
              <Text style={styles.ctaBody}>{copy.reportBody}</Text>
            </View>
            <View style={styles.ctaIcon}><Plus size={26} color="#FFFFFF" /></View>
          </View>
          <View style={styles.featureRow}>
            <View style={styles.feature}><Camera size={14} color="#BBF7D0" /><Text style={styles.featureText}>{copy.photo}</Text></View>
            <View style={styles.feature}><MapPin size={14} color="#BBF7D0" /><Text style={styles.featureText}>{copy.gps}</Text></View>
            <View style={styles.feature}><Sparkles size={14} color="#BBF7D0" /><Text style={styles.featureText}>{copy.aiAnalysis}</Text></View>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate("ReportTab")}
            activeOpacity={0.78}
            style={styles.ctaButton}
            accessibilityRole="button"
            accessibilityLabel={copy.reportButton}
          >
            <Plus size={19} color="#14532D" />
            <Text style={styles.ctaButtonText}>{copy.reportButton}</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{copy.statsTitle}</Text>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: isDark ? "rgba(96,165,250,0.16)" : "#DBEAFE" }]}><FileText size={17} color={colors.secondary} /></View>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.total}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{copy.total}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: isDark ? "rgba(251,191,36,0.14)" : "#FEF3C7" }]}><Navigation size={17} color="#F59E0B" /></View>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.processing}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{copy.processing}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: isDark ? "rgba(34,197,94,0.14)" : "#DCFCE7" }]}><CheckCircle2 size={17} color={colors.primary} /></View>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.completed}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{copy.completed}</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, styles.sectionHeaderTitle, { color: colors.text }]}>
            {activeReports.some((alert) => !INACTIVE_STATUSES.has(alert.status?.toUpperCase())) ? copy.active : copy.recent}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("MyReportsTab")}
            style={styles.viewAllButton}
            accessibilityRole="button"
            accessibilityLabel={copy.viewAll}
          >
            <Text style={[styles.viewAllText, { color: colors.primary }]}>{copy.viewAll}</Text>
            <ChevronRight size={15} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {activeReports.length > 0 ? activeReports.map(renderReport) : (
          <Card style={styles.emptyCard}>
            <FileText size={30} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>{copy.empty}</Text>
            <TouchableOpacity onPress={() => navigation.navigate("ReportTab")} style={[styles.emptyButton, { backgroundColor: colors.primaryLight }]} accessibilityRole="button">
              <Text style={[styles.emptyButtonText, { color: isDark ? "#86EFAC" : colors.primaryDark }]}>{copy.emptyButton}</Text>
            </TouchableOpacity>
          </Card>
        )}

        <TouchableOpacity
          onPress={() => navigation.navigate("AssistantTab")}
          activeOpacity={0.76}
          style={[styles.aiCard, { backgroundColor: isDark ? "#16233B" : "#F2F7FF", borderColor: isDark ? "#30466A" : "#D7E4F8" }]}
          accessibilityRole="button"
          accessibilityLabel={copy.askAi}
        >
          <View style={[styles.aiIcon, { backgroundColor: isDark ? "rgba(96,165,250,0.16)" : "#DBEAFE" }]}><Bot size={23} color={colors.secondary} /></View>
          <View style={styles.aiCopy}>
            <View style={styles.aiTitleRow}><Sparkles size={14} color={colors.primary} /><Text style={[styles.aiTitle, { color: colors.text }]}>EcoAlert AI</Text></View>
            <Text style={[styles.aiBody, { color: colors.textMuted }]}>{copy.aiBody}</Text>
            <Text style={[styles.aiLink, { color: colors.secondary }]}>{copy.askAi} →</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 36, gap: 16 },
  header: { minHeight: 60, borderBottomWidth: 1, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandMark: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  brandText: { fontSize: 20, fontWeight: "900", letterSpacing: -0.5 },
  headerActions: { flexDirection: "row", gap: 9 },
  headerButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  unreadBadge: { position: "absolute", right: -3, top: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  unreadText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  avatarButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontWeight: "900" },
  greetingBlock: { gap: 3 },
  greeting: { fontSize: 24, lineHeight: 30, fontWeight: "900", letterSpacing: -0.5 },
  greetingBody: { fontSize: 13, lineHeight: 19 },
  currentLocationRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 },
  currentLocationText: { flex: 1, fontSize: 12, fontWeight: "700" },
  reportCta: { borderRadius: 20, padding: 17, gap: 14 },
  ctaHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  ctaCopy: { flex: 1 },
  ctaTitle: { color: "#FFFFFF", fontSize: 18, lineHeight: 23, fontWeight: "900" },
  ctaBody: { color: "#D1FAE5", fontSize: 12, lineHeight: 18, marginTop: 5 },
  ctaIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.13)", alignItems: "center", justifyContent: "center" },
  featureRow: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  feature: { flexDirection: "row", alignItems: "center", gap: 5 },
  featureText: { color: "#D1FAE5", fontSize: 11, fontWeight: "700" },
  ctaButton: { minHeight: 48, backgroundColor: "#FFFFFF", borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  ctaButtonText: { color: "#14532D", fontSize: 14, fontWeight: "900" },
  sectionTitle: { fontSize: 18, fontWeight: "900", letterSpacing: -0.25, marginTop: 4 },
  statsRow: { flexDirection: "row", gap: 9 },
  statCard: { flex: 1, minHeight: 104, borderWidth: 1, borderRadius: 16, padding: 11 },
  statIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 24, fontWeight: "900", marginTop: 7, fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 10, fontWeight: "700", marginTop: 1 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 3 },
  sectionHeaderTitle: { flex: 1, marginTop: 0 },
  viewAllButton: { minHeight: 40, paddingLeft: 10, flexDirection: "row", alignItems: "center" },
  viewAllText: { fontSize: 12, fontWeight: "800" },
  reportCard: { padding: 14, borderRadius: 17 },
  reportTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 9 },
  reportTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  reportTitle: { flex: 1, fontSize: 15, fontWeight: "900" },
  aiMetaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 7 },
  aiMetaText: { flex: 1, fontSize: 11, fontWeight: "700" },
  reportFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 11 },
  reportLocation: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  reportMetaText: { flex: 1, fontSize: 10 },
  relativeTime: { fontSize: 10, fontWeight: "600" },
  emptyCard: { alignItems: "center", paddingVertical: 26, gap: 10 },
  emptyText: { fontSize: 12, textAlign: "center" },
  emptyButton: { minHeight: 40, borderRadius: 12, paddingHorizontal: 14, justifyContent: "center" },
  emptyButtonText: { fontSize: 12, fontWeight: "800" },
  aiCard: { borderWidth: 1, borderRadius: 20, padding: 16, flexDirection: "row", gap: 12, marginTop: 2 },
  aiIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  aiCopy: { flex: 1 },
  aiTitleRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  aiTitle: { fontSize: 16, fontWeight: "900" },
  aiBody: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  aiLink: { fontSize: 12, fontWeight: "900", marginTop: 9 },
});
