import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { LocateFixed, MapPin, X } from "lucide-react-native";
import { formatDistanceToNow, isValid } from "date-fns";
import { enUS, vi } from "date-fns/locale";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type {
  CitizenStackParamList,
  CitizenTabParamList,
} from "../../navigation/types";
import { useAlerts } from "../../hooks/useAlerts";
import { useProfile } from "../../hooks/useAuth";
import { useDashboardLocation } from "../../hooks/useDashboardLocation";
import { useLocation } from "../../hooks/useLocation";
import { useLanguage } from "../../context/LanguageContext";
import { useCivicTheme } from "../../theme/useCivicTheme";
import { civicStyles, civicType } from "../../theme/civicDesign";
import { CitizenHeader } from "../../components/citizen/CitizenHeader";
import { EvidenceImageFrame } from "../../components/media/EvidenceImageFrame";
import {
  getCategoryLabel,
  getWorkflowStatusLabel,
} from "../../utils/aiAnalysis";
import {
  distanceMeters,
  getIncidentGroup,
  INCIDENT_COLORS,
  NEARBY_RADIUS_METERS,
  toMapCoordinate,
} from "../../utils/citizenIncidents";
import type { MapFilter } from "../../utils/citizenIncidents";

type Props = BottomTabScreenProps<CitizenTabParamList, "MapTab">;
const FILTERS: MapFilter[] = [
  "ALL",
  "NEARBY",
  "PENDING",
  "PROCESSING",
  "RESOLVED",
];

export const CitizenMapScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useCivicTheme();
  const { language } = useLanguage();
  const isVietnamese = language === "vi";
  const alertsQuery = useAlerts(1, 100);
  const profile = useProfile();
  const device = useLocation();
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [filter, setFilter] = useState<MapFilter>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const currentCoordinate = toMapCoordinate(device.coords);
  const visibleMarkers = useMemo(
    () =>
      markers.filter((marker) => {
        if (filter === "ALL") return true;
        if (filter === "NEARBY")
          return currentCoordinate
            ? distanceMeters(currentCoordinate, marker.coordinate) <=
                NEARBY_RADIUS_METERS
            : true;
        return marker.group === filter;
      }),
    [
      markers,
      filter,
      currentCoordinate?.latitude,
      currentCoordinate?.longitude,
    ],
  );
  const selected = visibleMarkers.find(
    (marker) => marker.alert._id === selectedId,
  );
  const labels: Record<MapFilter, string> = isVietnamese
    ? {
        ALL: "Tất cả",
        NEARBY: "Gần tôi",
        PENDING: "Chưa xử lý",
        PROCESSING: "Đang xử lý",
        RESOLVED: "Đã xử lý",
      }
    : {
        ALL: "All",
        NEARBY: "Near me",
        PENDING: "Pending",
        PROCESSING: "In progress",
        RESOLVED: "Resolved",
      };

  // Passive cached locations can resolve after native MapView has mounted.
  useEffect(() => {
    if (mapReady && !currentCoordinate) {
      mapRef.current?.animateToRegion(
        { ...location, latitudeDelta: 0.08, longitudeDelta: 0.08 },
        350,
      );
    }
  }, [
    mapReady,
    location.latitude,
    location.longitude,
    currentCoordinate?.latitude,
    currentCoordinate?.longitude,
  ]);

  const locate = async (nearby: boolean) => {
    if (device.loading) return;
    const result = await device.fetchLocation();
    const coordinate = toMapCoordinate(result?.coords);
    if (!coordinate) return; // Incidents remain visible if GPS is denied/unavailable.
    if (nearby) setFilter("NEARBY");
    mapRef.current?.animateToRegion(
      { ...coordinate, latitudeDelta: 0.045, longitudeDelta: 0.045 },
      400,
    );
  };
  const time =
    selected && isValid(new Date(selected.alert.createdAt))
      ? formatDistanceToNow(new Date(selected.alert.createdAt), {
          addSuffix: true,
          locale: isVietnamese ? vi : enUS,
        })
      : "";
  const imageUri =
    selected?.alert.fieldEvidence?.[0]?.displayUrl ||
    selected?.alert.fieldEvidence?.[0]?.originalUrl ||
    selected?.alert.mediaUrls?.[0];

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <CitizenHeader
        avatarLabel={profile.data?.fullName?.charAt(0).toUpperCase() || "E"}
        onProfile={() =>
          navigation
            .getParent<NativeStackNavigationProp<CitizenStackParamList>>()
            ?.navigate("Profile")
        }
      />
      <View style={styles.mapArea}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
          initialRegion={{
            ...location,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08,
          }}
          onMapReady={() => setMapReady(true)}
          showsUserLocation={Boolean(currentCoordinate)}
          showsMyLocationButton={false}
        >
          {visibleMarkers.map(({ alert, coordinate, group }) => (
            <Marker
              key={alert._id}
              coordinate={coordinate}
              pinColor={INCIDENT_COLORS[group]}
              tracksViewChanges={false}
              onPress={() => setSelectedId(alert._id)}
            />
          ))}
        </MapView>
        <View pointerEvents="box-none" style={styles.topOverlay}>
          <View
            style={[
              styles.heading,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <MapPin size={18} color={colors.primary} />
            <View style={styles.headingCopy}>
              <Text style={[civicType.section, { color: colors.text }]}>
                {isVietnamese ? "Bản đồ điểm rác" : "Waste incident map"}
              </Text>
              <Text style={[civicType.meta, { color: colors.textMuted }]}>
                {visibleMarkers.length}{" "}
                {isVietnamese
                  ? "điểm hiển thị · tối đa 100 báo cáo gần nhất"
                  : "points shown · latest 100 reports"}
                {filter === "NEARBY" ? " · 5 km" : ""}
              </Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
          >
            {FILTERS.map((item) => (
              <TouchableOpacity
                key={item}
                accessibilityRole="button"
                accessibilityState={{
                  selected: filter === item,
                  disabled: item === "NEARBY" && device.loading,
                }}
                disabled={item === "NEARBY" && device.loading}
                onPress={() =>
                  item === "NEARBY" ? void locate(true) : setFilter(item)
                }
                style={[
                  styles.chip,
                  {
                    backgroundColor:
                      filter === item ? colors.greenSoft : colors.surface,
                    borderColor:
                      filter === item ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: filter === item ? colors.primary : colors.text },
                  ]}
                >
                  {labels[item]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {(alertsQuery.isLoading ||
            alertsQuery.isError ||
            !visibleMarkers.length ||
            device.error) && (
            <View
              accessibilityLiveRegion="polite"
              style={[
                styles.notice,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {alertsQuery.isLoading && (
                <ActivityIndicator size="small" color={colors.primary} />
              )}
              <Text
                style={[
                  civicType.meta,
                  styles.noticeText,
                  { color: colors.textSecondary },
                ]}
              >
                {device.error
                  ? isVietnamese
                    ? "Chưa lấy được vị trí. Hãy cấp quyền GPS hoặc thử lại; bản đồ vẫn hiển thị các sự cố."
                    : "Location unavailable. Allow GPS or retry; incidents remain visible."
                  : alertsQuery.isLoading
                    ? isVietnamese
                      ? "Đang tải điểm rác..."
                      : "Loading incidents..."
                    : alertsQuery.isError
                      ? isVietnamese
                        ? "Không tải được dữ liệu bản đồ."
                        : "Could not load incidents."
                      : isVietnamese
                        ? "Chưa có điểm rác phù hợp với bộ lọc."
                        : "No incidents match this filter."}
              </Text>
              {alertsQuery.isError && (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => void alertsQuery.refetch()}
                  style={styles.retry}
                >
                  <Text style={{ color: colors.primary }}>
                    {isVietnamese ? "Thử lại" : "Retry"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
        <View pointerEvents="box-none" style={styles.bottomOverlay}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              isVietnamese ? "Đến vị trí hiện tại" : "Go to current location"
            }
            disabled={device.loading}
            onPress={() => void locate(false)}
            style={[
              styles.locate,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {device.loading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <LocateFixed size={22} color={colors.primary} />
            )}
          </TouchableOpacity>
          {selected && (
            <View
              style={[
                styles.preview,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.previewRow}>
                {imageUri ? (
                  <EvidenceImageFrame
                    imageUri={imageUri}
                    showExpandIcon={false}
                    style={styles.image}
                  />
                ) : (
                  <View
                    style={[
                      styles.image,
                      styles.imagePlaceholder,
                      { backgroundColor: colors.soft },
                    ]}
                  >
                    <MapPin color={colors.textMuted} size={24} />
                  </View>
                )}
                <View style={styles.previewCopy}>
                  <Text
                    style={[
                      civicType.meta,
                      { color: INCIDENT_COLORS[selected.group] },
                    ]}
                  >
                    {getWorkflowStatusLabel(selected.alert.status, language)}
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={[civicType.cardTitle, { color: colors.text }]}
                  >
                    {selected.alert.title ||
                      getCategoryLabel(selected.alert.category, language)}
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={[civicType.meta, { color: colors.textMuted }]}
                  >
                    {selected.alert.address ||
                      (isVietnamese
                        ? "Đã ghi nhận vị trí trên bản đồ"
                        : "Location recorded on map")}
                  </Text>
                  <Text style={[civicType.meta, { color: colors.textMuted }]}>
                    {time}
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={
                    isVietnamese ? "Đóng xem trước" : "Close preview"
                  }
                  onPress={() => setSelectedId(null)}
                  style={civicStyles.iconButton}
                >
                  <X size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() =>
                  navigation
                    .getParent<
                      NativeStackNavigationProp<CitizenStackParamList>
                    >()
                    ?.navigate("AlertDetail", { id: selected.alert._id })
                }
                style={[
                  civicStyles.primaryButton,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text style={[civicType.button, { color: "#07101F" }]}>
                  {isVietnamese ? "Xem chi tiết" : "View details"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  mapArea: { flex: 1, overflow: "hidden" },
  topOverlay: { position: "absolute", top: 12, left: 16, right: 16, gap: 8 },
  heading: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  headingCopy: { flex: 1, minWidth: 0, gap: 2 },
  filters: { gap: 6 },
  chip: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  chipText: { fontSize: 12, fontWeight: "700" },
  notice: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  noticeText: { flex: 1 },
  retry: { minHeight: 44, justifyContent: "center" },
  bottomOverlay: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    gap: 12,
  },
  locate: {
    alignSelf: "flex-end",
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  preview: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 12 },
  previewRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  previewCopy: { flex: 1, minWidth: 0, gap: 4 },
  image: { width: 72, height: 96, aspectRatio: undefined, borderRadius: 10 },
  imagePlaceholder: { alignItems: "center", justifyContent: "center" },
});
