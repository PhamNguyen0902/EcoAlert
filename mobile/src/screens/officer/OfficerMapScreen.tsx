import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Callout } from "react-native-maps";
import { MapPin, RefreshCw, AlertTriangle } from "lucide-react-native";
import { useAlerts } from "../../hooks/useAlerts";
import { Badge } from "../../components/ui/Badge";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { SEVERITY_COLORS } from "../../utils/constants";
import { getCategoryLabel, getStatusLabel } from "../../utils/incidentPresentation";

type MapScreenProps = { navigation: any; mode?: 'admin' | 'officer' };

export const OfficerMapScreen: React.FC<MapScreenProps> = ({ navigation, mode = 'officer' }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { language } = useLanguage();
  const { data: alertsData, isLoading, refetch, isRefetching } = useAlerts(1, 100);

  const alerts = alertsData?.items ?? [];

  const initialRegion = {
    latitude: 10.762622,
    longitude: 106.660172,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };
  const isAdminMap = mode === 'admin';
  const title = isAdminMap ? 'Bản đồ GIS' : 'Bản đồ Giám sát Sự cố';
  const subtitle = isAdminMap
    ? `Vị trí thực tế để xác minh và điều phối (${alerts.length} báo cáo)`
    : `Vị trí các sự cố môi trường (${alerts.length} báo cáo)`;
  const openDetail = (id: string) => {
    const target = isAdminMap ? 'AlertDetail' : 'OfficerAlertDetail';
    (isAdminMap ? navigation.getParent?.() : navigation)?.navigate(target, { id });
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

      <MapView style={styles.map} initialRegion={initialRegion}>
        {alerts.map((alert) => {
          const coords = alert.location?.coordinates;
          if (!coords || coords.length < 2) return null;
          const lat = coords[1];
          const lng = coords[0];
          const sevColor = SEVERITY_COLORS[alert.severity ?? "low"]?.text || colors.primary;

          return (
            <Marker
              key={alert._id}
              coordinate={{ latitude: lat, longitude: lng }}
              pinColor={sevColor}
            >
              <Callout onPress={() => openDetail(alert._id)}>
                <View style={styles.calloutBox}>
                  <Text style={[styles.calloutTitle, { color: colors.text }]} numberOfLines={1}>
                    {alert.title}
                  </Text>
                  <Text style={[styles.calloutCategory, { color: colors.textMuted }]}>{getCategoryLabel(alert.category, language)}</Text>
                  <Text style={[styles.calloutStatus, { color: colors.secondary }]}>{language === "vi" ? "Trạng thái" : "Status"}: {getStatusLabel(alert.status, language)}</Text>
                  <Text style={[styles.calloutCta, { color: colors.primaryDark }]}>{isAdminMap ? 'Nhấn để xem hồ sơ ›' : 'Nhấn để xem & xử lý ›'}</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>
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
  calloutBox: { width: 180, padding: 4 },
  calloutTitle: { fontSize: 13, fontWeight: "700" },
  calloutCategory: { fontSize: 11, marginTop: 2 },
  calloutStatus: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  calloutCta: { fontSize: 11, fontWeight: "700", marginTop: 4 },
});

