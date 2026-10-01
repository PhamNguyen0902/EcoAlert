import React, { useMemo, useState } from "react";
import { Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { Bell, Camera, CheckCircle2, ChevronRight, Clock3, FileText, MapPin, Navigation, ScanLine, ShieldCheck, UserRound } from "lucide-react-native";
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
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { getCategoryLabel, getWorkflowStatusLabel } from "../../utils/aiAnalysis";
import { DARK_STATUS_COLORS, STATUS_COLORS } from "../../utils/constants";

type Props = BottomTabScreenProps<CitizenTabParamList, "DashboardTab">;

const PROCESSING_STATUSES = new Set(["PENDING", "AI_ANALYZING", "VERIFIED", "ASSIGNED", "IN_PROGRESS"]);
const COMPLETED_STATUSES = new Set(["RESOLVED", "CLOSED"]);
const INACTIVE_STATUSES = new Set(["RESOLVED", "CLOSED", "REJECTED"]);

const displayName = (fullName?: string): string => {
  const normalized = fullName?.trim();
  if (!normalized) return "EcoAlert";
  return normalized.split(/\s+/).at(-1) ?? normalized;
};

export const CitizenDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { language } = useLanguage();
  const profile = useProfile();
  const alertsQuery = useAlerts(1, 30);
  const [refreshing, setRefreshing] = useState(false);
  const alerts = alertsQuery.data?.items ?? [];
  const { location, isResolvingDeviceLocation } = useDashboardLocation(alerts[0]);

  const copy = language === "vi" ? {
    hello: "Xin chào", resolvingLocation: "Đang xác định vị trí...", fieldTag: "TÁC NGHIỆP HIỆN TRƯỜNG",
    reportTitle: "Báo cáo điểm rác", reportBody: "Phát hiện điểm rác? Chụp ảnh trực tiếp tại hiện trường và gửi cho EcoAlert.",
    capture: "Camera trực tiếp", gps: "GPS chính xác", vision: "Nhận diện rác", reportNow: "BÁO CÁO RÁC NGAY",
    stats: "Hồ sơ hoạt động của bạn", period: "Thời gian qua", total: "Tổng báo cáo", processing: "Đang xử lý", completed: "Đã xử lý",
    nearby: "Sự cố gần bạn", viewMap: "XEM BẢN ĐỒ", active: "Đang được xử lý", all: "TẤT CẢ",
    noReports: "Bạn chưa có báo cáo nào.", firstReport: "Tạo báo cáo đầu tiên", unknownLocation: "Chưa có địa chỉ",
    fieldInfo: "Báo cáo tại hiện trường", fieldBody: "EcoAlert sử dụng ảnh được chụp trực tiếp cùng vị trí GPS và thời gian ghi nhận để tăng độ tin cậy của báo cáo.",
    camera: "Camera", time: "Thời gian", officer: "Cán bộ", unassigned: "Đang chờ phân công",
  } : {
    hello: "Hello", resolvingLocation: "Determining your location...", fieldTag: "FIELD OPERATIONS",
    reportTitle: "Report a waste site", reportBody: "Spotted waste? Take a live photo at the site and send it to EcoAlert.",
    capture: "Live camera", gps: "Accurate GPS", vision: "Waste detection", reportNow: "REPORT WASTE NOW",
    stats: "Your activity", period: "This period", total: "Total reports", processing: "In progress", completed: "Resolved",
    nearby: "Incidents near you", viewMap: "VIEW MAP", active: "Being handled", all: "ALL",
    noReports: "You have not submitted a report yet.", firstReport: "Create your first report", unknownLocation: "Address unavailable",
    fieldInfo: "Field reporting", fieldBody: "EcoAlert uses live-captured photos with GPS and recorded time to strengthen each report.",
    camera: "Camera", time: "Time", officer: "Officer", unassigned: "Awaiting assignment",
  };

  const stats = useMemo(() => {
    let processing = 0;
    let completed = 0;
    alerts.forEach((alert) => {
      const status = alert.status?.toUpperCase();
      if (PROCESSING_STATUSES.has(status)) processing += 1;
      if (COMPLETED_STATUSES.has(status)) completed += 1;
    });
    return { total: alertsQuery.data?.total ?? alerts.length, processing, completed };
  }, [alerts, alertsQuery.data?.total]);

  const activeReports = useMemo(() => {
    const active = alerts.filter((alert) => !INACTIVE_STATUSES.has(alert.status?.toUpperCase()));
    return (active.length ? active : alerts).slice(0, 3);
  }, [alerts]);

  const mappableAlerts = useMemo(() => alerts.filter((alert) => {
    const [longitude, latitude] = alert.location?.coordinates ?? [];
    return Number.isFinite(latitude) && Number.isFinite(longitude);
  }).slice(0, 12), [alerts]);

  const openAlert = (id: string) => navigation.getParent<NativeStackNavigationProp<CitizenStackParamList>>()?.navigate("AlertDetail", { id });
  const refresh = async () => { setRefreshing(true); try { await alertsQuery.refetch(); } finally { setRefreshing(false); } };

  const renderReport = (alert: AlertItem) => {
    const statusKey = alert.status?.toUpperCase() || "PENDING";
    const palette = (isDark ? DARK_STATUS_COLORS : STATUS_COLORS)[statusKey] ?? (isDark ? DARK_STATUS_COLORS : STATUS_COLORS).PENDING;
    const time = formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true, locale: language === "vi" ? vi : enUS });
    return <TouchableOpacity key={alert._id} activeOpacity={0.76} onPress={() => openAlert(alert._id)} accessibilityRole="button" accessibilityLabel={`${alert.title}. ${getWorkflowStatusLabel(alert.status, language)}`}>
      <Card style={styles.reportCard}>
        <View style={styles.reportTopRow}><Badge label={getWorkflowStatusLabel(alert.status, language)} type="custom" bgColor={palette.bg} textColor={palette.text} /><Text style={[styles.reportTime, { color: colors.textMuted }]}>{time}</Text></View>
        <View style={styles.reportTitleRow}><View style={[styles.reportIcon, { backgroundColor: isDark ? "rgba(56,189,248,0.12)" : "#E0F2FE" }]}><FileText size={16} color={colors.secondary} /></View><Text style={[styles.reportTitle, { color: colors.text }]} numberOfLines={1}>{getCategoryLabel(alert.category, language) || alert.title}</Text><ChevronRight size={17} color={colors.textMuted} /></View>
        <View style={styles.reportAddress}><MapPin size={13} color={colors.textMuted} /><Text style={[styles.reportAddressText, { color: colors.textMuted }]} numberOfLines={1}>{alert.address || copy.unknownLocation}</Text></View>
        <View style={styles.reportOfficer}><UserRound size={12} color={colors.primary} /><Text style={[styles.reportOfficerText, { color: colors.textMuted }]} numberOfLines={1}>{copy.officer}: {alert.assignedOfficerName || copy.unassigned}</Text></View>
      </Card>
    </TouchableOpacity>;
  };

  return <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
    <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={styles.brandRow}><View style={[styles.brandMark, { backgroundColor: isDark ? "rgba(34,197,94,0.16)" : colors.primaryLight }]}><Navigation size={18} color={colors.primary} fill={colors.primary} /></View><View><Text style={[styles.brandText, { color: colors.text }]}>EcoAlert</Text><Text style={[styles.brandSubtext, { color: colors.textMuted }]}>TRASH CIVIC</Text></View></View>
      <View style={styles.headerActions}><TouchableOpacity disabled style={[styles.headerButton, { borderColor: colors.border, backgroundColor: colors.card }]} accessibilityRole="button" accessibilityLabel="Thông báo"><Bell size={19} color={colors.textMuted} /></TouchableOpacity><TouchableOpacity onPress={() => navigation.navigate("ProfileTab")} style={[styles.avatarButton, { backgroundColor: isDark ? "#164E35" : colors.primaryLight, borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel="Hồ sơ cá nhân"><Text style={[styles.avatarText, { color: colors.primary }]}>{displayName(profile.data?.fullName).charAt(0).toUpperCase()}</Text></TouchableOpacity></View>
    </View>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>
      <View style={styles.greetingBlock}><Text style={[styles.greeting, { color: colors.text }]} numberOfLines={1}>{copy.hello}, {displayName(profile.data?.fullName)} 👋</Text><View style={styles.currentLocationRow}><MapPin size={14} color={colors.primary} /><Text style={[styles.currentLocationText, { color: colors.textMuted }]} numberOfLines={1}>{isResolvingDeviceLocation ? copy.resolvingLocation : location.label}</Text></View></View>
      <View style={[styles.reportCta, { backgroundColor: isDark ? "#101D31" : "#F0FDF4", borderColor: isDark ? "rgba(34,197,94,0.34)" : "#BBF7D0" }]}><Text style={[styles.eyebrow, { color: colors.primary }]}>{copy.fieldTag}</Text><View style={styles.ctaHeader}><View style={styles.ctaCopy}><Text style={[styles.ctaTitle, { color: colors.text }]}>{copy.reportTitle}</Text><Text style={[styles.ctaBody, { color: colors.textMuted }]}>{copy.reportBody}</Text></View><View style={[styles.ctaIcon, { backgroundColor: colors.primary }]}><Camera size={22} color="#07101F" /></View></View><View style={styles.featureRow}><Feature icon={<Camera size={14} color={colors.primary} />} label={copy.capture} color={colors.textMuted} /><Feature icon={<MapPin size={14} color={colors.primary} />} label={copy.gps} color={colors.textMuted} /><Feature icon={<ScanLine size={14} color={colors.primary} />} label={copy.vision} color={colors.textMuted} /></View><TouchableOpacity onPress={() => navigation.navigate("ReportTab")} activeOpacity={0.8} style={[styles.ctaButton, { backgroundColor: colors.primary }]} accessibilityRole="button" accessibilityLabel={copy.reportNow}><Camera size={18} color="#07101F" /><Text style={styles.ctaButtonText}>{copy.reportNow}</Text></TouchableOpacity></View>
      <SectionHeading title={copy.stats} action={copy.period} colors={colors} />
      <View style={styles.statsRow}><StatCard value={stats.total} label={copy.total} color="#38BDF8" /><StatCard value={stats.processing} label={copy.processing} color="#F59E0B" /><StatCard value={stats.completed} label={copy.completed} color="#22C55E" /></View>
      <SectionHeading title={copy.nearby} action={copy.viewMap} colors={colors} />
      <Card style={styles.mapCard}><MapView provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined} style={styles.map} initialRegion={{ latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.045, longitudeDelta: 0.045 }} scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false}><Marker coordinate={{ latitude: location.latitude, longitude: location.longitude }} pinColor="#38BDF8" title={location.label} />{mappableAlerts.map((alert) => <Marker key={alert._id} coordinate={{ latitude: alert.location.coordinates[1], longitude: alert.location.coordinates[0] }} pinColor="#F87171" title={alert.title} />)}</MapView><View style={[styles.mapCaption, { backgroundColor: colors.card, borderColor: colors.border }]}><MapPin size={12} color={colors.primary} /><Text style={[styles.mapCaptionText, { color: colors.text }]} numberOfLines={1}>{mappableAlerts.length ? `${mappableAlerts.length} ${language === "vi" ? "báo cáo được hiển thị" : "reports shown"}` : location.label}</Text></View></Card>
      <SectionHeading title={copy.active} action={copy.all} colors={colors} onPress={() => navigation.navigate("MyReportsTab")} />
      {activeReports.length ? activeReports.map(renderReport) : <Card style={styles.emptyCard}><FileText size={28} color={colors.textMuted} /><Text style={[styles.emptyText, { color: colors.textMuted }]}>{copy.noReports}</Text><TouchableOpacity onPress={() => navigation.navigate("ReportTab")} style={[styles.emptyButton, { backgroundColor: colors.primary }]} accessibilityRole="button"><Text style={styles.emptyButtonText}>{copy.firstReport}</Text></TouchableOpacity></Card>}
      <Card style={[styles.fieldInfo, { backgroundColor: isDark ? "#0B1628" : colors.card }]}><View style={[styles.fieldIcon, { backgroundColor: isDark ? "rgba(34,197,94,0.14)" : colors.primaryLight }]}><ShieldCheck size={20} color={colors.primary} /></View><View style={styles.fieldCopy}><Text style={[styles.fieldTitle, { color: colors.text }]}>{copy.fieldInfo}</Text><Text style={[styles.fieldBody, { color: colors.textMuted }]}>{copy.fieldBody}</Text><View style={styles.fieldLabels}><FieldLabel icon={<Camera size={12} color={colors.primary} />} label={copy.camera} color={colors.textMuted} /><FieldLabel icon={<MapPin size={12} color={colors.primary} />} label="GPS" color={colors.textMuted} /><FieldLabel icon={<Clock3 size={12} color={colors.primary} />} label={copy.time} color={colors.textMuted} /></View></View></Card>
    </ScrollView>
  </View>;
};

const Feature = ({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) => <View style={styles.feature}><View>{icon}</View><Text style={[styles.featureText, { color }]} numberOfLines={1}>{label}</Text></View>;
const FieldLabel = ({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) => <View style={styles.fieldLabel}><View>{icon}</View><Text style={[styles.fieldLabelText, { color }]}>{label}</Text></View>;
const SectionHeading = ({ title, action, colors, onPress }: { title: string; action: string; colors: { text: string; textMuted: string; primary: string }; onPress?: () => void }) => <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>{onPress ? <TouchableOpacity onPress={onPress} style={styles.sectionAction} accessibilityRole="button" accessibilityLabel={action}><Text style={[styles.sectionActionText, { color: colors.primary }]}>{action}</Text><ChevronRight size={14} color={colors.primary} /></TouchableOpacity> : <Text style={[styles.periodText, { color: colors.textMuted }]}>{action}</Text>}</View>;
const StatCard = ({ value, label, color }: { value: number; label: string; color: string }) => <View style={[styles.statCard, { borderColor: `${color}44`, backgroundColor: `${color}12` }]}><Text style={[styles.statValue, { color }]}>{value}</Text><Text style={styles.statLabel} numberOfLines={2}>{label}</Text></View>;

const styles = StyleSheet.create({
  container: { flex: 1 }, scroll: { flex: 1 }, content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 32, gap: 20 },
  header: { minHeight: 62, borderBottomWidth: 1, paddingHorizontal: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, brandRow: { flexDirection: "row", alignItems: "center", gap: 9 }, brandMark: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" }, brandText: { fontSize: 18, fontWeight: "900", letterSpacing: -0.4 }, brandSubtext: { marginTop: 1, fontSize: 9, fontWeight: "800", letterSpacing: 1.2 }, headerActions: { flexDirection: "row", alignItems: "center", gap: 8 }, headerButton: { width: 40, height: 40, borderWidth: 1, borderRadius: 13, alignItems: "center", justifyContent: "center" }, avatarButton: { width: 40, height: 40, borderWidth: 1, borderRadius: 13, alignItems: "center", justifyContent: "center" }, avatarText: { fontSize: 15, fontWeight: "900" },
  greetingBlock: { gap: 7 }, greeting: { fontSize: 23, lineHeight: 29, fontWeight: "900", letterSpacing: -0.5 }, currentLocationRow: { flexDirection: "row", alignItems: "center", gap: 6 }, currentLocationText: { flex: 1, fontSize: 12, fontWeight: "600" },
  reportCta: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 14 }, eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.1 }, ctaHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 }, ctaCopy: { flex: 1 }, ctaTitle: { fontSize: 20, lineHeight: 25, fontWeight: "900", letterSpacing: -0.4 }, ctaBody: { marginTop: 5, fontSize: 13, lineHeight: 19 }, ctaIcon: { width: 45, height: 45, borderRadius: 15, alignItems: "center", justifyContent: "center" }, featureRow: { flexDirection: "row", gap: 8 }, feature: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 4 }, featureText: { flex: 1, fontSize: 10, fontWeight: "700" }, ctaButton: { minHeight: 50, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, ctaButtonText: { color: "#07101F", fontSize: 13, fontWeight: "900", letterSpacing: 0.25 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sectionTitle: { flex: 1, fontSize: 17, fontWeight: "900", letterSpacing: -0.25 }, periodText: { fontSize: 11, fontWeight: "700" }, sectionAction: { minHeight: 40, flexDirection: "row", alignItems: "center", paddingLeft: 10 }, sectionActionText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.4 },
  statsRow: { flexDirection: "row", gap: 8 }, statCard: { flex: 1, minHeight: 86, borderWidth: 1, borderRadius: 16, padding: 11, justifyContent: "space-between" }, statValue: { fontSize: 25, fontWeight: "900", fontVariant: ["tabular-nums"] }, statLabel: { color: "#94A3B8", fontSize: 10, lineHeight: 13, fontWeight: "700" },
  mapCard: { height: 204, padding: 0, overflow: "hidden", borderRadius: 18 }, map: { ...StyleSheet.absoluteFill }, mapCaption: { position: "absolute", left: 10, bottom: 10, maxWidth: "78%", borderWidth: 1, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 5 }, mapCaptionText: { flexShrink: 1, fontSize: 10, fontWeight: "800" },
  reportCard: { padding: 14, borderRadius: 16 }, reportTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }, reportTime: { fontSize: 10, fontWeight: "600" }, reportTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 }, reportIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" }, reportTitle: { flex: 1, fontSize: 14, fontWeight: "800" }, reportAddress: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 5 }, reportAddressText: { flex: 1, fontSize: 11 }, reportOfficer: { marginTop: 7, flexDirection: "row", alignItems: "center", gap: 5 }, reportOfficerText: { flex: 1, fontSize: 11, fontWeight: "600" },
  emptyCard: { alignItems: "center", paddingVertical: 25, gap: 10 }, emptyText: { fontSize: 12, textAlign: "center" }, emptyButton: { minHeight: 42, borderRadius: 12, paddingHorizontal: 14, justifyContent: "center" }, emptyButtonText: { color: "#07101F", fontSize: 12, fontWeight: "900" },
  fieldInfo: { flexDirection: "row", borderRadius: 16, padding: 14, gap: 11 }, fieldIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" }, fieldCopy: { flex: 1 }, fieldTitle: { fontSize: 14, fontWeight: "900" }, fieldBody: { marginTop: 4, fontSize: 12, lineHeight: 17 }, fieldLabels: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 10 }, fieldLabel: { flexDirection: "row", alignItems: "center", gap: 4 }, fieldLabelText: { fontSize: 10, fontWeight: "700" },
});
