import React, { useMemo } from "react";
import {
  ActivityIndicator,
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
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type {
  CitizenStackParamList,
  CitizenTabParamList,
} from "../../navigation/types";
import { useAlerts, useCitizenReports } from "../../hooks/useAlerts";
import { useProfile } from "../../hooks/useAuth";
import { useUnreadNotificationCount } from "../../hooks/useNotifications";
import { useDashboardLocation } from "../../hooks/useDashboardLocation";
import { useCivicTheme } from "../../theme/useCivicTheme";
import { civicStyles, civicType } from "../../theme/civicDesign";
import {
  CitizenActionTile,
  CitizenAvatar,
  CitizenSectionHeading,
  CitizenTopBar,
} from "../../components/citizen/v2/CitizenUI";
import { CitizenReportCard } from "../../components/citizen/CitizenReportCard";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { getWorkflowStatusLabel } from "../../utils/aiAnalysis";
import {
  getIncidentGroup,
  INCIDENT_COLORS,
  toMapCoordinate,
} from "../../utils/citizenIncidents";
import { reportImage, reportTime } from "../../utils/citizenPresentation";

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
  const recent =
    ownReports.data?.pages
      .flatMap((page) => page.items)
      .filter((alert) => !alert.isDeleted)
      .slice(0, 3) ?? [];
  const parent = () =>
    navigation.getParent<NativeStackNavigationProp<CitizenStackParamList>>();
  const report = () => navigation.navigate("ReportTab");
  const map = () => navigation.navigate("MapTab");
  const mine = () => navigation.navigate("MyReportsTab");
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
        <View
          style={[
            styles.hero,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Svg
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            width="100%"
            height="100%"
            viewBox="0 0 360 200"
            preserveAspectRatio="xMidYMid slice"
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <Path
                key={i}
                d={`M ${180 + i * 16} -20 C ${80 + i * 32} 70, ${400 - i * 12} 50, ${260 + i * 30} 220`}
                fill="none"
                stroke={colors.cyan}
                strokeOpacity={0.09}
                strokeWidth={1}
              />
            ))}
          </Svg>
          <View style={styles.heroBrand}>
            <Text style={[styles.brand, { color: colors.primary }]}>
              EcoAlert
            </Text>
            <Text style={[civicType.meta, { color: colors.textMuted }]}>
              Ghi nhận để thay đổi
            </Text>
          </View>
          <View style={styles.person}>
            <CitizenAvatar user={profile} size={54} />
            <View style={styles.flex}>
              <Text style={[civicType.meta, { color: colors.textMuted }]}>
                {profile ? "XIN CHÀO, CÔNG DÂN" : "CHÀO MỪNG BẠN"}
              </Text>
              <Text style={[styles.name, { color: colors.text }]}>
                {profile?.fullName || "Khách EcoAlert"}
              </Text>
              <Text style={[civicType.meta, { color: colors.cyan }]}>
                Cùng xây dựng thành phố xanh hơn
              </Text>
            </View>
          </View>
          <View style={styles.row}>
            <CitizenActionTile
              compact
              icon={Camera}
              title="Báo cáo rác"
              subtitle="Gửi phản ánh mới"
              onPress={report}
            />
            <CitizenActionTile
              compact
              icon={ClipboardList}
              title="Theo dõi"
              subtitle="Hồ sơ của tôi"
              tone="cyan"
              onPress={mine}
            />
          </View>
        </View>
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
              region={{
                ...location,
                latitudeDelta: 0.08,
                longitudeDelta: 0.08,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              userInterfaceStyle={isDark ? "dark" : "light"}
            >
              {markers.map(({ alert, coordinate, group }) => (
                <Marker
                  key={alert._id}
                  coordinate={coordinate}
                  pinColor={INCIDENT_COLORS[group]}
                  title={alert.title}
                  tracksViewChanges={false}
                />
              ))}
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
            <ActivityIndicator color={colors.primary} />
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
                onPress={profile ? report : () => parent()?.navigate("Profile")}
                accessibilityRole="button"
                style={[
                  civicStyles.secondaryButton,
                  { borderColor: colors.border },
                ]}
              >
                <Text style={[civicType.button, { color: colors.primary }]}>
                  {profile ? "Tạo báo cáo đầu tiên" : "Thông tin đăng nhập"}
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
  hero: {
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    gap: 18,
    overflow: "hidden",
  },
  heroBrand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  brand: { fontSize: 20, fontWeight: "900" },
  person: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { fontSize: 20, fontWeight: "800", marginVertical: 4 },
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
