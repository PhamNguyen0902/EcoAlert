import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { OfficerStackParamList } from "../../navigation/types";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from "react-native-maps";
import { MapPin, RefreshCw, AlertTriangle } from "lucide-react-native";
import { useAlerts, useOfficerTasks } from "../../hooks/useAlerts";
import { Badge } from "../../components/ui/Badge";
import { useCivicTheme } from "../../theme/useCivicTheme";
import { useLanguage } from "../../context/LanguageContext";
import { SEVERITY_COLORS } from "../../utils/constants";
import { getCategoryLabel, getStatusLabel, getSeverityLabel } from "../../utils/incidentPresentation";
import { getOfficerTaskState, filterOfficerTasks } from "../../utils/officerWorkflow";
import { getGeoJsonMapCoordinates } from "../../utils/maps";

type MapScreenProps = { mode?: 'admin' | 'officer' };

export const OfficerMapScreen: React.FC<MapScreenProps> = ({ mode = 'officer' }) => {
  const navigation = useNavigation<NativeStackNavigationProp<OfficerStackParamList>>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useCivicTheme();
  const { language } = useLanguage();
  const isAdminMap = mode === 'admin';
  const adminQuery = useAlerts(1, 100, {}, isAdminMap);
  const officerQuery = useOfficerTasks(1, 100, undefined, { enabled: !isAdminMap, allPages: true });
  const { data: alertsData, isLoading, refetch, isRefetching, isError } = isAdminMap ? adminQuery : officerQuery;

  const alerts = isAdminMap ? alertsData?.items ?? [] : filterOfficerTasks(alertsData?.items ?? [], "ALL");

  const initialRegion = {
    latitude: 10.762622,
    longitude: 106.660172,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };
  const title = isAdminMap ? 'Bản đồ GIS' : 'Bản đồ nhiệm vụ';
  const subtitle = isAdminMap
    ? `Vị trí thực tế để xác minh và điều phối (${alerts.length} báo cáo)`
    : `Vị trí các điểm rác được phân công cho bạn (${alerts.length})`;
  const openDetail = (id: string) => {
    const target = isAdminMap ? 'AlertDetail' : 'OfficerAlertDetail';
    if (isAdminMap) navigation.getParent()?.navigate(target, { id });
    else navigation.navigate("OfficerAlertDetail", { id });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Sticky Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            {subtitle}
          </Text>
        </View>
        <TouchableOpacity style={[styles.refreshBtn, { backgroundColor: isDark ? "rgba(59, 130, 246, 0.25)" : "#DBEAFE" }]} onPress={() => refetch()} disabled={isRefetching}>
          {isRefetching ? (
            <ActivityIndicator size="small" color={isDark ? "#60A5FA" : colors.secondary} />
          ) : (
            <RefreshCw size={18} color={isDark ? "#60A5FA" : colors.secondary} />
          )}
        </TouchableOpacity>
      </View>

      <MapView provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined} style={styles.map} initialRegion={initialRegion}>
        {alerts.map((alert) => {
          const coords = getGeoJsonMapCoordinates(alert.location?.coordinates);
          if (!coords) return null;
          const sevColor = isAdminMap ? SEVERITY_COLORS[alert.severity ?? "low"]?.text || colors.primary : getOfficerTaskState(alert).color;

          return (
            <Marker
              key={alert._id}
              coordinate={coords}
              pinColor={sevColor}
            >
              <Callout onPress={() => openDetail(alert._id)}>
                <View style={[styles.calloutBox, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.calloutTitle, { color: colors.text }]} numberOfLines={1}>
                    {alert.title}
                  </Text>
                  <Text style={[styles.calloutCategory, { color: colors.textMuted }]}>{getCategoryLabel(alert.category, language)}</Text>
                  <Text style={[styles.calloutCategory, { color: colors.textMuted }]} numberOfLines={3}>{alert.address || "Đã ghi nhận vị trí GPS"}</Text>
                  <Text style={[styles.calloutStatus, { color: sevColor }]}>{isAdminMap ? getStatusLabel(alert.status, language) : getOfficerTaskState(alert).label}</Text>
                  <Text style={[styles.calloutCategory, { color: colors.textMuted }]}>{getSeverityLabel(alert.severity, language)}</Text>
                  <Text style={[styles.calloutCta, { color: colors.primary }]}>{isAdminMap ? 'Nhấn để xem hồ sơ ›' : 'Xem nhiệm vụ ›'}</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>
      {isLoading || isError || alerts.length === 0 ? <View style={[styles.notice, { backgroundColor: colors.surface }]}>
        <Text style={{ color: colors.text }}>{isLoading ? "Đang tải bản đồ..." : isError ? "Không thể tải nhiệm vụ. Bấm làm mới để thử lại." : "Chưa có nhiệm vụ trên bản đồ."}</Text>
      </View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    zIndex: 10,
    elevation: 4,
  },
  headerTitle: { fontSize: 22, fontWeight: "800" },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  map: { flex: 1 },
  notice: { position: "absolute", bottom: 16, left: 16, right: 16, padding: 12, borderRadius: 12 },
  calloutBox: { width: 180, padding: 4 },
  calloutTitle: { fontSize: 13, fontWeight: "700" },
  calloutCategory: { fontSize: 11, marginTop: 2 },
  calloutStatus: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  calloutCta: { fontSize: 11, fontWeight: "700", marginTop: 4 },
});

