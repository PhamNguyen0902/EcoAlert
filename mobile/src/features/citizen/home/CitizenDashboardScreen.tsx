import React, { useCallback, useMemo } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import {
  Bell,
  Camera,
  ClipboardList,
  MapPin,
  Plus,
  type LucideIcon,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type {
  CitizenStackParamList,
  CitizenTabParamList,
} from "../../../navigation/types";
import { useAlerts, useCitizenReports } from "../../../hooks/useAlerts";
import { useProfile } from "../../auth/hooks/useAuth";
import { useUnreadNotificationCount } from "../../notifications/hooks/useNotifications";
import { useDashboardLocation } from "../nearby/useDashboardLocation";
import { useCivicTheme } from "../../../theme/useCivicTheme";
import { civicStyles, civicType } from "../../../theme/civicDesign";
import {
  CitizenActionTile,
  CitizenSectionHeading,
  CitizenTopBar,
} from "../components/v2/CitizenUI";
import { CitizenReportCard } from "../components/CitizenReportCard";
import { CitizenActivitySkeleton } from "../components/CitizenActivitySkeleton";
import { HomeHero } from "../components/hero/HomeHero";
import { Badge } from "../../../shared/components/ui/Badge";
import { Card } from "../../../shared/components/ui/Card";
import { getWorkflowStatusLabel } from "../../incidents/model/aiAnalysis";
import {
  getIncidentGroup,
  INCIDENT_COLORS,
  toMapCoordinate,
} from "../model/citizenIncidents";
import { reportImage, reportTime } from "../model/citizenPresentation";

export const CitizenDashboardScreen: React.FC<
  BottomTabScreenProps<CitizenTabParamList, "DashboardTab">
> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useCivicTheme();
  const { data: profile } = useProfile();
  const unread = useUnreadNotificationCount();
  const alertsQuery = useAlerts(1, 30);
  const ownReports = useCitizenReports(profile?._id);
  const markers = useMemo(
    () =>
      (alertsQuery.data?.items ?? []).flatMap((alert) => {
        const coordinate = toMapCoordinate(alert.location);
        const group = getIncidentGroup(alert.status);
        return coordinate && group && !alert.isDeleted
          ? [{ alert, coordinate, group }]
          : [];
      }),
    [alertsQuery.data],
  );
  const { location } = useDashboardLocation(markers[0]?.alert);
  const mapRegion = useMemo(
    () => ({
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    }),
    [location.latitude, location.longitude],
  );
  const markerElements = useMemo(
    () => markers.map(({ alert, coordinate, group }) => (
      <Marker
        key={alert._id}
        coordinate={coordinate}
        pinColor={INCIDENT_COLORS[group]}
        title={alert.title}
        tracksViewChanges={false}
      />
    )),
    [markers],
  );
  const recent = useMemo(
    () => ownReports.data?.pages
      .flatMap((page) => page.items)
      .filter((alert) => !alert.isDeleted)
      .slice(0, 3) ?? [],
    [ownReports.data],
  );
  const parent = () =>
    navigation.getParent<NativeStackNavigationProp<CitizenStackParamList>>();
  const report = useCallback(
    () => navigation.navigate("ReportTab"),
    [navigation],
  );
  const map = () => navigation.navigate("MapTab");
  const mine = useCallback(
    () => navigation.navigate("MyReportsTab"),
    [navigation],
  );
  const notifications = () => parent()?.navigate("Notifications");
  const utilities: { title: string; icon: LucideIcon; onPress: () => void }[] =
    [
      { title: "Báo cáo mới", icon: Plus, onPress: report },
      { title: "Điểm gần tôi", icon: MapPin, onPress: map },
      { title: "Của tôi", icon: ClipboardList, onPress: mine },
      { title: "Thông báo", icon: Bell, onPress: notifications },
    ];
  const refresh = async () => {
    await Promise.all([
      alertsQuery.refetch(),
      ...(profile ? [ownReports.refetch()] : []),
    ]);
  };
  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <CitizenTopBar
        title="Trang chủ"
        user={profile}
        unreadCount={unread.data ?? 0}
        onNotifications={notifications}
        onProfile={() => parent()?.navigate("Profile")}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={alertsQuery.isRefetching || ownReports.isRefetching}
            onRefresh={() => void refresh()}
            tintColor={colors.primary}
          />
        }
      >
        <HomeHero user={profile} onReport={report} onTrack={mine} />
        <View style={styles.section}>
          <CitizenSectionHeading title="Khám phá EcoAlert" />
          <View style={styles.row}>
            <CitizenActionTile
              icon={MapPin}
              title="Điểm rác bản đồ"
              subtitle="Khám phá các báo cáo quanh bạn"
              tone="cyan"
              onPress={map}
            />
            <CitizenActionTile
              icon={ClipboardList}
              title="Báo cáo của tôi"
              subtitle="Theo dõi tiến độ xử lý"
              onPress={mine}
            />
          </View>
          <View style={styles.row}>
            <CitizenActionTile
              icon={Camera}
              title="Tạo báo cáo"
              subtitle="Chụp ảnh và gửi vị trí hiện trường"
              tone="amber"
              onPress={report}
            />
            <CitizenActionTile
              icon={Bell}
              title="Thông báo"
              subtitle="Cập nhật phản hồi mới nhất"
              tone="cyan"
              onPress={notifications}
            />
          </View>
        </View>
        <View style={styles.section}>
          <CitizenSectionHeading
            title="Bản đồ điểm rác"
            action="Xem tất cả"
            onPress={map}
          />
          <Pressable
            onPress={map}
            accessibilityRole="button"
            accessibilityLabel="Mở bản đồ điểm rác"
            style={[
              styles.mapCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <MapView
              provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
              region={mapRegion}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              userInterfaceStyle={isDark ? "dark" : "light"}
            >
              {markerElements}
            </MapView>
            <View
              style={[styles.mapCaption, { backgroundColor: colors.surface }]}
            >
              <MapPin size={14} color={colors.primary} />
              <Text
                style={[civicType.meta, styles.flex, { color: colors.text }]}
              >
                {alertsQuery.isLoading
                  ? "Đang tải bản đồ…"
                  : alertsQuery.isError
                    ? "Chưa tải được dữ liệu · Mở bản đồ để thử lại"
                    : markers.length
                      ? `${markers.length} điểm trong 30 báo cáo mới nhất`
                      : "Chưa có điểm rác có tọa độ hợp lệ"}
              </Text>
            </View>
          </Pressable>
        </View>
        <View>
          <CitizenSectionHeading title="Tiện ích của bạn" />
          <Card appearance="civic" style={styles.utilityRow}>
            {utilities.map(({ title, icon: Icon, onPress }) => (
              <Pressable
                key={title}
                onPress={onPress}
                accessibilityRole="button"
                style={styles.utility}
              >
                <View
                  style={[
                    styles.utilityIcon,
                    { backgroundColor: colors.greenSoft },
                  ]}
                >
                  <Icon size={21} color={colors.primary} />
                </View>
                <Text
                  style={[
                    civicType.meta,
                    styles.utilityText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {title}
                </Text>
              </Pressable>
            ))}
          </Card>
        </View>
        <View style={styles.section}>
          <CitizenSectionHeading
            title="Hoạt động gần đây"
            action="Tất cả"
            onPress={mine}
          />
          {profile && ownReports.isLoading ? (
            <CitizenActivitySkeleton />
          ) : recent.length ? (
            recent.map((alert) => (
              <Pressable
                key={alert._id}
                onPress={() =>
                  parent()?.navigate("AlertDetail", { id: alert._id })
                }
                accessibilityRole="button"
                accessibilityLabel={`Xem ${alert.title}`}
              >
                <CitizenReportCard
                  compact
                  title={alert.title}
                  address={alert.address || "Đã ghi nhận vị trí"}
                  time={reportTime(alert.createdAt)}
                  imageUri={reportImage(alert)}
                  status={
                    <Badge
                      appearance="civic"
                      label={getWorkflowStatusLabel(alert.status, "vi")}
                      statusValue={alert.status}
                      type="status"
                    />
                  }
                />
              </Pressable>
            ))
          ) : (
            <Card appearance="civic" style={styles.empty}>
              <ClipboardList size={28} color={colors.cyan} />
              <Text style={[civicType.body, { color: colors.textMuted }]}>
                {ownReports.isError
                  ? "Chưa tải được hoạt động. Kéo xuống để thử lại."
                  : profile
                    ? "Bạn chưa gửi báo cáo nào."
                    : "Đăng nhập để xem hoạt động của bạn."}
              </Text>
              <Pressable
                onPress={
                  profile
                    ? ownReports.isError
                      ? () => void ownReports.refetch({ cancelRefetch: false })
                      : report
                    : () => parent()?.navigate("Profile")
                }
                disabled={Boolean(profile && ownReports.isRefetching)}
                accessibilityState={{
                  disabled: Boolean(profile && ownReports.isRefetching),
                  busy: Boolean(profile && ownReports.isRefetching),
                }}
                accessibilityRole="button"
                style={[
                  civicStyles.secondaryButton,
                  { borderColor: colors.border },
                ]}
              >
                <Text style={[civicType.button, { color: colors.primary }]}>
                  {profile
                    ? ownReports.isError
                      ? "Thử lại"
                      : "Tạo báo cáo đầu tiên"
                    : "Thông tin đăng nhập"}
                </Text>
              </Pressable>
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
};
const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 24,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: "row", gap: 10 },
  section: { gap: 10 },
  mapCard: {
    height: 210,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
  },
  mapCaption: {
    position: "absolute",
    bottom: 10,
    left: 10,
    right: 10,
    borderRadius: 12,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  utilityRow: { flexDirection: "row", gap: 4, paddingHorizontal: 8 },
  utility: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 8,
    minHeight: 72,
  },
  utilityIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  utilityText: { textAlign: "center" },
  empty: { gap: 14, alignItems: "center" },
});
