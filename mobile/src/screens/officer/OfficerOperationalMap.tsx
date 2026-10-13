import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert as RNAlert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Crosshair,
  Minus,
  Plus,
  Search,
  Flag,
  RefreshCw,
} from "lucide-react-native";
import { useOfficerTasks } from "../../hooks/useAlerts";
import { useOfficerPosition } from "../../hooks/useOfficerPosition";
import {
  useForegroundScreen,
  useScreenClock,
} from "../../hooks/useForegroundScreen";
import { useCivicTheme } from "../../theme/useCivicTheme";
import { getOfficerRoute } from "../../api/officerRouting";
import {
  OfficerHeader,
  officerStyles as s,
} from "../../components/officer/OfficerUI";
import { OfficerTaskCard } from "../../components/officer/OfficerTaskCard";
import { OfficerTaskFilters } from "../../components/officer/OfficerTaskFilters";
import { Button } from "../../components/ui/Button";
import { getGeoJsonMapCoordinates, openGoogleMaps } from "../../utils/maps";
import {
  filterOfficerTasks,
  getOfficerTaskState,
  officerErrorMessage,
  type OfficerTaskFilter,
} from "../../utils/officerWorkflow";
import { searchOfficerTasks } from "../../utils/officerPresentation";
import { useFieldReducedMotion } from "../../features/report/components/stitch/FieldUI";
import type {
  OfficerStackParamList,
  OfficerTabParamList,
} from "../../navigation/types";

// hiển thị bản đồ các nhiệm vụ, vẽ đường đi bằng osrm và hỗ trợ lọc điểm rác
export function OfficerOperationalMap() {
  const { colors, isDark } = useCivicTheme();
  const reducedMotion = useFieldReducedMotion();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<OfficerStackParamList>>();
  const screenRoute =
    useRoute<RouteProp<OfficerTabParamList, "OfficerMapTab">>();
  const query = useOfficerTasks(1, 100, undefined, { allPages: true });
  const gps = useOfficerPosition();
  const foreground = useForegroundScreen();
  const now = useScreenClock(30_000, foreground);
  const [filter, setFilter] = useState<OfficerTaskFilter>("ALL");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>(
    screenRoute.params?.selectedId,
  );
  const [routeRequested, setRouteRequested] = useState(false);
  const [opening, setOpening] = useState(false);
  const [mapHeight, setMapHeight] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const openingLock = useRef(false);
  const map = useRef<MapView>(null);
  const region = useRef({
    latitude: 10.762622,
    longitude: 106.660172,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  });
  const tasks = filterOfficerTasks(query.data?.items || [], "ALL");
  const visible = searchOfficerTasks(filterOfficerTasks(tasks, filter), search);
  const selected =
    visible.find((task) => task._id === selectedId) || visible[0];
  const destination = getGeoJsonMapCoordinates(selected?.location?.coordinates);
  const fresh =
    gps.position && now - Date.parse(gps.position.recordedAt) < 120_000;
  // gọi dịch vụ vẽ tuyến đường ngắn nhất từ vị trí cán bộ đến điểm rác
  const route = useQuery({
    queryKey: [
      "officer-route",
      selected?._id,
      gps.position?.recordedAt,
      destination?.latitude,
      destination?.longitude,
    ],
    enabled: Boolean(routeRequested && fresh && destination && foreground),
    queryFn: ({ signal }) =>
      getOfficerRoute(gps.position!, destination!, signal),
    staleTime: 60_000,
    retry: 1,
  });
  useEffect(() => {
    if (screenRoute.params?.selectedId) {
      setSelectedId(screenRoute.params.selectedId);
      setFilter("ALL");
      setSearch("");
    }
  }, [screenRoute.params?.selectedId]);
  useEffect(() => {
    setRouteRequested(false);
    if (destination)
      map.current?.animateToRegion(
        { ...destination, latitudeDelta: 0.008, longitudeDelta: 0.008 },
        reducedMotion ? 0 : 300,
      );
  }, [
    selected?._id,
    destination?.latitude,
    destination?.longitude,
    reducedMotion,
  ]);
  useEffect(() => {
    if (mapReady && mapHeight > 0 && route.data && fresh && routeRequested)
      map.current?.fitToCoordinates(route.data.points, {
        edgePadding: {
          top: Math.min(130, Math.round(mapHeight * 0.3)),
          left: 24,
          right: 48,
          bottom: Math.min(70, Math.round(mapHeight * 0.15)),
        },
        animated: false,
      });
  }, [mapReady, mapHeight, route.data, fresh, routeRequested]);
  // mở ứng dụng google maps để chỉ đường đến vị trí điểm rác đang chọn
  const external = async () => {
    if (!destination || openingLock.current) return;
    openingLock.current = true;
    setOpening(true);
    try {
      const result = await openGoogleMaps(
        destination.latitude,
        destination.longitude,
        "navigate",
      );
      if (!result.success)
        RNAlert.alert("Chưa mở được Google Maps", "Vui lòng thử lại.");
    } finally {
      openingLock.current = false;
      setOpening(false);
    }
  };
  // phóng to hoặc thu nhỏ khung nhìn bản đồ
  const zoom = (factor: number) =>
    map.current?.animateToRegion(
      {
        ...region.current,
        latitudeDelta: Math.min(
          80,
          Math.max(0.0005, region.current.latitudeDelta * factor),
        ),
        longitudeDelta: Math.min(
          80,
          Math.max(0.0005, region.current.longitudeDelta * factor),
        ),
      },
      reducedMotion ? 0 : 250,
    );
  // danh sách các nút điều khiển căn giữa vị trí và phóng to thu nhỏ bản đồ
  const controls = [
    {
      label: "Lấy GPS và về vị trí của tôi",
      icon: Crosshair,
      press: async () => {
        const point = await gps.refresh();
        if (point)
          map.current?.animateToRegion(
            { ...point, latitudeDelta: 0.008, longitudeDelta: 0.008 },
            reducedMotion ? 0 : 300,
          );
      },
    },
    {
      label: "Về vị trí nhiệm vụ",
      icon: Flag,
      press: () => {
        if (destination)
          map.current?.animateToRegion(
            { ...destination, latitudeDelta: 0.008, longitudeDelta: 0.008 },
            reducedMotion ? 0 : 300,
          );
      },
    },
    { label: "Phóng to", icon: Plus, press: () => zoom(0.5) },
    { label: "Thu nhỏ", icon: Minus, press: () => zoom(2) },
    {
      label: "Làm mới nhiệm vụ",
      icon: RefreshCw,
      press: () => void query.refetch(),
    },
  ];
  return (
    <View
      style={[
        s.screen,
        { paddingTop: insets.top, backgroundColor: colors.background },
      ]}
    >
      <OfficerHeader title="Bản đồ tác nghiệp" />
      <View
        onLayout={(event) => setMapHeight(event.nativeEvent.layout.height)}
        style={{ flex: 1, minHeight: 190, overflow: "hidden" }}
      >
        <MapView
          ref={map}
          style={{ flex: 1 }}
          provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
          userInterfaceStyle={isDark ? "dark" : "light"}
          customMapStyle={isDark ? darkOfficerMap : []}
          initialRegion={region.current}
          onRegionChangeComplete={(next) => {
            region.current = next;
          }}
          onMapReady={() => {
            setMapReady(true);
            if (destination && !routeRequested)
              map.current?.animateToRegion(
                { ...destination, latitudeDelta: 0.01, longitudeDelta: 0.01 },
                0,
              );
          }}
        >
          {visible.map((task) => {
            const point = getGeoJsonMapCoordinates(task.location?.coordinates);
            return point ? (
              <Marker
                key={task._id}
                coordinate={point}
                title={task.title}
                pinColor={getOfficerTaskState(task).color}
                onPress={() => setSelectedId(task._id)}
              />
            ) : null;
          })}
          {gps.position && fresh && (
            <Marker
              coordinate={gps.position}
              title="Vị trí GPS vừa lấy"
              pinColor="#22C55E"
            />
          )}
          {routeRequested && fresh && route.data && (
            <Polyline
              coordinates={route.data.points}
              strokeColor="#38BDF8"
              strokeWidth={5}
            />
          )}
        </MapView>
        <View
          style={{ position: "absolute", top: 12, left: 12, right: 12, gap: 8 }}
        >
          <View
            style={[
              s.row,
              {
                borderRadius: 14,
                backgroundColor: colors.surface,
                paddingHorizontal: 12,
              },
            ]}
          >
            <Search color={colors.cyan} size={17} />
            <TextInput
              accessibilityLabel="Tìm nhiệm vụ trên bản đồ"
              value={search}
              onChangeText={setSearch}
              placeholder="Tìm trong các nhiệm vụ của bạn"
              placeholderTextColor={colors.textMuted}
              style={{
                flex: 1,
                minHeight: 46,
                color: colors.text,
                fontSize: 12,
              }}
              clearButtonMode="while-editing"
            />
          </View>
          <OfficerTaskFilters
            tasks={tasks}
            value={filter}
            onChange={setFilter}
          />
        </View>
        <View
          style={{
            position: "absolute",
            right: 12,
            bottom: 12,
            flexDirection: mapHeight < 400 ? "row" : "column",
            gap: 6,
          }}
        >
          {controls.map(({ label, icon: Icon, press }) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() => void press()}
              disabled={gps.pending && label.startsWith("Lấy GPS")}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon size={18} color={colors.cyan} />
            </Pressable>
          ))}
        </View>
        {(query.isLoading || gps.pending || route.isFetching) && (
          <ActivityIndicator
            accessibilityLabel="Đang tải bản đồ, GPS hoặc tuyến đường"
            style={{ position: "absolute", bottom: 16, left: 16 }}
            color={colors.primary}
          />
        )}
      </View>
      <ScrollView
        style={{ maxHeight: 250, flexGrow: 0, backgroundColor: colors.surface }}
        contentContainerStyle={{ padding: 12, gap: 8 }}
      >
        {!selected ? (
          <Text style={[s.body, { color: colors.textMuted }]}>
            {query.isLoading
              ? "Đang tải nhiệm vụ..."
              : query.isError
                ? "Không tải được nhiệm vụ. Bấm làm mới để thử lại."
                : "Không có nhiệm vụ phù hợp trên bản đồ."}
          </Text>
        ) : (
          <>
            {query.isError && (
              <Text
                accessibilityRole="alert"
                style={[s.meta, { color: colors.warning }]}
              >
                Chưa đồng bộ được nhiệm vụ. Đang hiển thị dữ liệu đã tải; Google
                Maps vẫn có thể mở.
              </Text>
            )}
            <OfficerTaskCard
              task={selected}
              compact
              onPress={() =>
                navigation.navigate("OfficerAlertDetail", { id: selected._id })
              }
            />
            {routeRequested && fresh && route.data && (
              <Text style={[s.meta, { color: colors.cyan }]}>
                Lộ trình OSRM · {(route.data.distanceMeters / 1000).toFixed(1)}{" "}
                km · khoảng {Math.ceil(route.data.durationSeconds / 60)} phút
                (không tính giao thông trực tiếp)
              </Text>
            )}
            {(gps.error || route.isError || (routeRequested && !fresh)) && (
              <Text
                accessibilityRole="alert"
                style={[s.meta, { color: colors.warning }]}
              >
                {gps.error ||
                  (!fresh
                    ? "GPS đã cũ. Lấy lại GPS để tính tuyến mới."
                    : officerErrorMessage(
                        route.error,
                        "Chưa tính được tuyến đường nội bộ TP.HCM. Vui lòng thử lại.",
                      ))}
              </Text>
            )}
            <View style={s.row}>
              <View style={s.grow}>
                <Button
                  appearance="civic"
                  size="sm"
                  title="BẮT ĐẦU CHỈ ĐƯỜNG"
                  textStyle={{ fontSize: 11 }}
                  loading={gps.pending || route.isFetching}
                  disabled={!destination || gps.pending || route.isFetching}
                  onPress={async () => {
                    if (await gps.refresh()) setRouteRequested(true);
                  }}
                />
              </View>
              <View style={s.grow}>
                <Button
                  appearance="civic"
                  size="sm"
                  variant="outline"
                  title="MỞ GOOGLE MAPS"
                  textStyle={{ fontSize: 11 }}
                  loading={opening}
                  disabled={!destination}
                  onPress={() => void external()}
                />
              </View>
            </View>
            <Text style={[s.meta, { color: colors.textMuted }]}>
              OSRM nội bộ · TP.HCM và vùng đệm 10 km. Tuyến ô tô, không có giao
              thông trực tiếp hoặc điều hướng giọng nói. Chưa hỗ trợ đầy đủ hạn
              chế riêng của xe máy. Google Maps chỉ mở khi bạn chủ động chọn nút
              riêng.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}
const darkOfficerMap = [
  { elementType: "geometry", stylers: [{ color: "#101D31" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#07101F" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#94A3B8" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#26384B" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#081827" }],
  },
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
];
