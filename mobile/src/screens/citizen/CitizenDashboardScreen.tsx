import React, { useMemo, useState } from "react";
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import {
  Camera,
  ChevronRight,
  Clock3,
  FileText,
  MapPin,
  ScanLine,
  ShieldCheck,
} from "lucide-react-native";
import { formatDistanceToNow } from "date-fns";
import { enUS, vi } from "date-fns/locale";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { Alert as AlertItem } from "../../types";
import type {
  CitizenStackParamList,
  CitizenTabParamList,
} from "../../navigation/types";
import { useAlerts } from "../../hooks/useAlerts";
import { useProfile } from "../../hooks/useAuth";
import { useDashboardLocation } from "../../hooks/useDashboardLocation";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { useCivicTheme } from "../../theme/useCivicTheme";
import {
  civicSpace as space,
  civicRadius as radius,
  civicType,
  civicStyles,
} from "../../theme/civicDesign";
import { CitizenHeader } from "../../components/citizen/CitizenHeader";
import { CitizenReportCard } from "../../components/citizen/CitizenReportCard";
import { useLanguage } from "../../context/LanguageContext";
import {
  getCategoryLabel,
  getWorkflowStatusLabel,
} from "../../utils/aiAnalysis";
import { DARK_STATUS_COLORS, STATUS_COLORS } from "../../utils/constants";

type Props = BottomTabScreenProps<CitizenTabParamList, "DashboardTab">;

const PROCESSING_STATUSES = new Set([
  "PENDING",
  "AI_ANALYZING",
  "VERIFIED",
  "ASSIGNED",
  "IN_PROGRESS",
]);
const COMPLETED_STATUSES = new Set(["RESOLVED", "CLOSED"]);
const INACTIVE_STATUSES = new Set(["RESOLVED", "CLOSED", "REJECTED"]);

const displayName = (fullName?: string): string => {
  const normalized = fullName?.trim();
  if (!normalized) return "EcoAlert";
  return normalized.split(/\s+/).at(-1) ?? normalized;
};

export const CitizenDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useCivicTheme();
  const { language } = useLanguage();
  const profile = useProfile();
  const alertsQuery = useAlerts(1, 30);
  const [refreshing, setRefreshing] = useState(false);
  const alerts = alertsQuery.data?.items ?? [];
  const { location, isResolvingDeviceLocation } = useDashboardLocation(
    alerts[0],
  );

  const copy =
    language === "vi"
      ? {
          hello: "Xin chào",
          resolvingLocation: "Đang xác định vị trí...",
          fieldTag: "TÁC NGHIỆP HIỆN TRƯỜNG",
          reportTitle: "Báo cáo điểm rác",
          reportBody:
            "Phát hiện điểm rác? Chụp ảnh trực tiếp tại hiện trường và gửi cho EcoAlert.",
          capture: "Camera trực tiếp",
          gps: "GPS chính xác",
          vision: "Nhận diện rác",
          reportNow: "BÁO CÁO RÁC NGAY",
          stats: "Hồ sơ hoạt động của bạn",
          period: "Thời gian qua",
          total: "Tổng báo cáo",
          processing: "Đang xử lý",
          completed: "Đã xử lý",
          nearby: "Sự cố gần bạn",
          viewMap: "XEM BẢN ĐỒ",
          active: "Đang được xử lý",
          all: "TẤT CẢ",
          noReports: "Bạn chưa có báo cáo nào.",
          firstReport: "Tạo báo cáo đầu tiên",
          unknownLocation: "Chưa có địa chỉ",
          fieldInfo: "Báo cáo tại hiện trường",
          fieldBody:
            "EcoAlert sử dụng ảnh được chụp trực tiếp cùng vị trí GPS và thời gian ghi nhận để tăng độ tin cậy của báo cáo.",
          camera: "Camera",
          time: "Thời gian",
          officer: "Cán bộ",
          unassigned: "Đang chờ phân công",
        }
      : {
          hello: "Hello",
          resolvingLocation: "Determining your location...",
          fieldTag: "FIELD OPERATIONS",
          reportTitle: "Report a waste site",
          reportBody:
            "Spotted waste? Take a live photo at the site and send it to EcoAlert.",
          capture: "Live camera",
          gps: "Accurate GPS",
          vision: "Waste detection",
          reportNow: "REPORT WASTE NOW",
          stats: "Your activity",
          period: "This period",
          total: "Total reports",
          processing: "In progress",
          completed: "Resolved",
          nearby: "Incidents near you",
          viewMap: "VIEW MAP",
          active: "Being handled",
          all: "ALL",
          noReports: "You have not submitted a report yet.",
          firstReport: "Create your first report",
          unknownLocation: "Address unavailable",
          fieldInfo: "Field reporting",
          fieldBody:
            "EcoAlert uses live-captured photos with GPS and recorded time to strengthen each report.",
          camera: "Camera",
          time: "Time",
          officer: "Officer",
          unassigned: "Awaiting assignment",
        };

  const stats = useMemo(() => {
    let processing = 0;
    let completed = 0;
    alerts.forEach((alert) => {
      const status = alert.status?.toUpperCase();
      if (PROCESSING_STATUSES.has(status)) processing += 1;
      if (COMPLETED_STATUSES.has(status)) completed += 1;
    });
    return {
      total: alertsQuery.data?.total ?? alerts.length,
      processing,
      completed,
    };
  }, [alerts, alertsQuery.data?.total]);

  const activeReports = useMemo(() => {
    const active = alerts.filter(
      (alert) => !INACTIVE_STATUSES.has(alert.status?.toUpperCase()),
    );
    return (active.length ? active : alerts).slice(0, 3);
  }, [alerts]);

  const mappableAlerts = useMemo(
    () =>
      alerts
        .filter((alert) => {
          const [longitude, latitude] = alert.location?.coordinates ?? [];
          return Number.isFinite(latitude) && Number.isFinite(longitude);
        })
        .slice(0, 12),
    [alerts],
  );

  const openAlert = (id: string) =>
    navigation
      .getParent<NativeStackNavigationProp<CitizenStackParamList>>()
      ?.navigate("AlertDetail", { id });
  const refresh = async () => {
    setRefreshing(true);
    try {
      await alertsQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const renderReport = (alert: AlertItem) => {
    const statusKey = alert.status?.toUpperCase() || "PENDING";
    const palette =
      (isDark ? DARK_STATUS_COLORS : STATUS_COLORS)[statusKey] ??
      (isDark ? DARK_STATUS_COLORS : STATUS_COLORS).PENDING;
    const time = formatDistanceToNow(new Date(alert.createdAt), {
      addSuffix: true,
      locale: language === "vi" ? vi : enUS,
    });
    return (
      <TouchableOpacity
        key={alert._id}
        activeOpacity={0.76}
        onPress={() => openAlert(alert._id)}
        accessibilityRole="button"
        accessibilityLabel={`${alert.title}. ${getWorkflowStatusLabel(alert.status, language)}`}
      >
        <CitizenReportCard
          compact
          title={alert.title || getCategoryLabel(alert.category, language)}
          address={alert.address || copy.unknownLocation}
          time={time}
          imageUri={
            alert.fieldEvidence?.[0]?.displayUrl ||
            alert.fieldEvidence?.[0]?.originalUrl ||
            alert.mediaUrls?.[0]
          }
          status={
            <Badge
              appearance="civic"
              label={getWorkflowStatusLabel(alert.status, language)}
              type="custom"
              bgColor={palette.bg}
              textColor={palette.text}
            />
          }
        />
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <CitizenHeader
        avatarLabel={displayName(profile.data?.fullName)
          .charAt(0)
          .toUpperCase()}
        onProfile={() =>
          navigation
            .getParent<NativeStackNavigationProp<CitizenStackParamList>>()
            ?.navigate("Profile")
        }
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.greetingBlock}>
          <Text
            style={[styles.greeting, { color: colors.text }]}
            numberOfLines={1}
          >
            {copy.hello}, {displayName(profile.data?.fullName)} 👋
          </Text>
          <View style={styles.currentLocationRow}>
            <MapPin size={14} color={colors.primary} />
            <Text
              style={[styles.currentLocationText, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              {isResolvingDeviceLocation
                ? copy.resolvingLocation
                : location.label}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.reportCta,
            {
              backgroundColor: isDark ? "#101D31" : "#F0FDF4",
              borderColor: isDark ? "rgba(34,197,94,0.34)" : "#BBF7D0",
            },
          ]}
        >
          <Text style={[styles.eyebrow, { color: colors.primary }]}>
            {copy.fieldTag}
          </Text>
          <View style={styles.ctaHeader}>
            <View style={styles.ctaCopy}>
              <Text style={[styles.ctaTitle, { color: colors.text }]}>
                {copy.reportTitle}
              </Text>
              <Text style={[styles.ctaBody, { color: colors.textMuted }]}>
                {copy.reportBody}
              </Text>
            </View>
            <View style={[styles.ctaIcon, { backgroundColor: colors.primary }]}>
              <Camera size={22} color="#07101F" />
            </View>
          </View>
          <View style={styles.featureRow}>
            <Feature
              icon={<Camera size={14} color={colors.primary} />}
              label={copy.capture}
              color={colors.textMuted}
            />
            <Feature
              icon={<MapPin size={14} color={colors.primary} />}
              label={copy.gps}
              color={colors.textMuted}
            />
            <Feature
              icon={<ScanLine size={14} color={colors.primary} />}
              label={copy.vision}
              color={colors.textMuted}
            />
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate("ReportTab")}
            activeOpacity={0.8}
            style={[styles.ctaButton, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel={copy.reportNow}
          >
            <Camera size={18} color="#07101F" />
            <Text style={styles.ctaButtonText}>{copy.reportNow}</Text>
          </TouchableOpacity>
        </View>
        <SectionHeading
          title={copy.stats}
          action={copy.period}
          colors={colors}
        />
        <View style={styles.statsRow}>
          <StatCard
            value={stats.total}
            label={copy.total}
            color={colors.cyan}
            labelColor={colors.textMuted}
          />
          <StatCard
            value={stats.processing}
            label={copy.processing}
            color={colors.warning}
            labelColor={colors.textMuted}
          />
          <StatCard
            value={stats.completed}
            label={copy.completed}
            color={colors.primary}
            labelColor={colors.textMuted}
          />
        </View>
        <SectionHeading
          title={copy.nearby}
          action={copy.viewMap}
          colors={colors}
          onPress={() => navigation.navigate("MapTab")}
        />
        <Card appearance="civic" style={styles.mapCard}>
          <MapView
            provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
            style={styles.map}
            onPress={() => navigation.navigate("MapTab")}
            initialRegion={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.045,
              longitudeDelta: 0.045,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
          >
            <Marker
              coordinate={{
                latitude: location.latitude,
                longitude: location.longitude,
              }}
              pinColor="#38BDF8"
              title={location.label}
            />
            {mappableAlerts.map((alert) => (
              <Marker
                key={alert._id}
                coordinate={{
                  latitude: alert.location.coordinates[1],
                  longitude: alert.location.coordinates[0],
                }}
                pinColor="#F87171"
                title={alert.title}
              />
            ))}
          </MapView>
          <View
            style={[
              styles.mapCaption,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <MapPin size={12} color={colors.primary} />
            <Text
              style={[styles.mapCaptionText, { color: colors.text }]}
              numberOfLines={1}
            >
              {mappableAlerts.length
                ? `${mappableAlerts.length} ${language === "vi" ? "báo cáo được hiển thị" : "reports shown"}`
                : location.label}
            </Text>
          </View>
        </Card>
        <SectionHeading
          title={copy.active}
          action={copy.all}
          colors={colors}
          onPress={() => navigation.navigate("MyReportsTab")}
        />
        {activeReports.length ? (
          activeReports.slice(0, 2).map(renderReport)
        ) : (
          <Card appearance="civic" style={styles.emptyCard}>
            <FileText size={28} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {copy.noReports}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("ReportTab")}
              style={[styles.emptyButton, { backgroundColor: colors.primary }]}
              accessibilityRole="button"
            >
              <Text style={styles.emptyButtonText}>{copy.firstReport}</Text>
            </TouchableOpacity>
          </Card>
        )}
        <Card
          appearance="civic"
          style={[
            styles.fieldInfo,
            { backgroundColor: isDark ? "#0B1628" : colors.card },
          ]}
        >
          <View
            style={[
              styles.fieldIcon,
              {
                backgroundColor: isDark
                  ? "rgba(34,197,94,0.14)"
                  : colors.primaryLight,
              },
            ]}
          >
            <ShieldCheck size={20} color={colors.primary} />
          </View>
          <View style={styles.fieldCopy}>
            <Text style={[styles.fieldTitle, { color: colors.text }]}>
              {copy.fieldInfo}
            </Text>
            <Text style={[styles.fieldBody, { color: colors.textMuted }]}>
              {copy.fieldBody}
            </Text>
            <View style={styles.fieldLabels}>
              <FieldLabel
                icon={<Camera size={12} color={colors.primary} />}
                label={copy.camera}
                color={colors.textMuted}
              />
              <FieldLabel
                icon={<MapPin size={12} color={colors.primary} />}
                label="GPS"
                color={colors.textMuted}
              />
              <FieldLabel
                icon={<Clock3 size={12} color={colors.primary} />}
                label={copy.time}
                color={colors.textMuted}
              />
            </View>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
};

const Feature = ({
  icon,
  label,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
}) => (
  <View style={styles.feature}>
    <View>{icon}</View>
    <Text style={[styles.featureText, { color }]} numberOfLines={1}>
      {label}
    </Text>
  </View>
);
const FieldLabel = ({
  icon,
  label,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
}) => (
  <View style={styles.fieldLabel}>
    <View>{icon}</View>
    <Text style={[styles.fieldLabelText, { color }]}>{label}</Text>
  </View>
);
const SectionHeading = ({
  title,
  action,
  colors,
  onPress,
}: {
  title: string;
  action: string;
  colors: { text: string; textMuted: string; primary: string };
  onPress?: () => void;
}) => (
  <View style={styles.sectionHeader}>
    <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
    {onPress ? (
      <TouchableOpacity
        onPress={onPress}
        style={styles.sectionAction}
        accessibilityRole="button"
        accessibilityLabel={action}
      >
        <Text style={[styles.sectionActionText, { color: colors.primary }]}>
          {action}
        </Text>
        <ChevronRight size={14} color={colors.primary} />
      </TouchableOpacity>
    ) : (
      <Text style={[styles.periodText, { color: colors.textMuted }]}>
        {action}
      </Text>
    )}
  </View>
);
const StatCard = ({
  value,
  label,
  color,
  labelColor,
}: {
  value: number;
  label: string;
  color: string;
  labelColor: string;
}) => (
  <View
    style={[
      styles.statCard,
      { borderColor: `${color}44`, backgroundColor: `${color}12` },
    ]}
  >
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={[styles.statLabel, { color: labelColor }]} numberOfLines={2}>
      {label}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { ...civicStyles.content, paddingBottom: space.page },
  greetingBlock: { gap: space.sm },
  greeting: civicType.title,
  currentLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  currentLocationText: { flex: 1, ...civicType.meta },
  reportCta: {
    borderRadius: radius.major,
    borderWidth: 1,
    padding: space.lg,
    gap: space.lg,
  },
  eyebrow: civicType.eyebrow,
  ctaHeader: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  ctaCopy: { flex: 1 },
  ctaTitle: { ...civicType.title, fontSize: 22, lineHeight: 28 },
  ctaBody: { ...civicType.body, marginTop: space.sm },
  ctaIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    alignItems: "center",
    justifyContent: "center",
  },
  featureRow: { flexDirection: "row", gap: space.sm },
  feature: { flex: 1, minWidth: 0, gap: space.xs },
  featureText: { ...civicType.meta },
  ctaButton: civicStyles.primaryButton,
  ctaButtonText: { ...civicType.button, color: "#07101F" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    marginBottom: -space.md,
  },
  sectionTitle: { flex: 1, ...civicType.section },
  periodText: civicType.meta,
  sectionAction: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: space.sm,
  },
  sectionActionText: civicType.technical,
  statsRow: { flexDirection: "row", gap: space.sm },
  statCard: {
    flex: 1,
    minHeight: 84,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.md,
    gap: space.xs,
  },
  statValue: { fontSize: 22, fontWeight: "800", fontVariant: ["tabular-nums"] },
  statLabel: { ...civicType.meta },
  mapCard: {
    height: 196,
    padding: 0,
    overflow: "hidden",
    borderRadius: radius.image,
  },
  map: { ...StyleSheet.absoluteFill },
  mapCaption: {
    position: "absolute",
    left: space.md,
    bottom: space.md,
    maxWidth: "78%",
    borderWidth: 1,
    borderRadius: radius.chip,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  mapCaptionText: { flexShrink: 1, ...civicType.meta },
  emptyCard: {
    alignItems: "center",
    paddingVertical: space.section,
    gap: space.md,
  },
  emptyText: civicType.body,
  emptyButton: { ...civicStyles.primaryButton, alignSelf: "stretch" },
  emptyButtonText: { ...civicType.button, color: "#07101F" },
  fieldInfo: { flexDirection: "row", gap: space.md },
  fieldIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.button,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldCopy: { flex: 1 },
  fieldTitle: civicType.cardTitle,
  fieldBody: { ...civicType.body, marginTop: space.xs },
  fieldLabels: {
    marginTop: space.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.md,
  },
  fieldLabel: { flexDirection: "row", alignItems: "center", gap: space.xs },
  fieldLabelText: civicType.meta,
});
