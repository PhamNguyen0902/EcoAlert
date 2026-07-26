import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Callout } from "react-native-maps";
import { MapPin, RefreshCw, AlertTriangle } from "lucide-react-native";
import { useAlerts } from "../../hooks/useAlerts";
import { Badge } from "../../components/ui/Badge";
import { COLORS, SEVERITY_COLORS } from "../../utils/constants";

export const OfficerMapScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { data: alertsData, isLoading, refetch, isRefetching } = useAlerts(1, 100);

  const alerts = alertsData?.items ?? [];

  const initialRegion = {
    latitude: 10.762622,
    longitude: 106.660172,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Sticky Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Incident Map View</Text>
          <Text style={styles.headerSubtitle}>
            Geotagged environmental alerts ({alerts.length} reports)
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => refetch()} disabled={isRefetching}>
          {isRefetching ? (
            <ActivityIndicator size="small" color={COLORS.secondary} />
          ) : (
            <RefreshCw size={18} color={COLORS.secondary} />
          )}
        </TouchableOpacity>
      </View>

      <MapView style={styles.map} initialRegion={initialRegion}>
        {alerts.map((alert) => {
          const coords = alert.location?.coordinates;
          if (!coords || coords.length < 2) return null;
          const lat = coords[1];
          const lng = coords[0];
          const sevColor = SEVERITY_COLORS[alert.severity]?.text || COLORS.primary;

          return (
            <Marker
              key={alert._id}
              coordinate={{ latitude: lat, longitude: lng }}
              pinColor={sevColor}
            >
              <Callout onPress={() => navigation.navigate("OfficerAlertDetail", { id: alert._id })}>
                <View style={styles.calloutBox}>
                  <Text style={styles.calloutTitle} numberOfLines={1}>
                    {alert.title}
                  </Text>
                  <Text style={styles.calloutCategory}>{alert.category?.toUpperCase()}</Text>
                  <Text style={styles.calloutStatus}>Status: {alert.status}</Text>
                  <Text style={styles.calloutCta}>Tap to view & verify ›</Text>
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
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    zIndex: 10,
    elevation: 4,
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: COLORS.text },
  headerSubtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  map: { flex: 1 },
  calloutBox: { width: 180, padding: 4 },
  calloutTitle: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  calloutCategory: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  calloutStatus: { fontSize: 11, color: COLORS.secondary, fontWeight: "600", marginTop: 2 },
  calloutCta: { fontSize: 11, color: COLORS.primaryDark, fontWeight: "700", marginTop: 4 },
});
