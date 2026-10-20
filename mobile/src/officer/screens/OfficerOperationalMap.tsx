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
  type GestureResponderEvent,
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
  Compass,
  Navigation2,
} from "lucide-react-native";
import { useOfficerTasks } from "../../shared/hooks/useAlerts";
import { useOfficerPosition } from "../hooks/useOfficerPosition";
import { useOfficerMapFollow } from "../hooks/useOfficerMapFollow";
import { FollowCameraGate, validMapFix } from "../utils/officerMapCamera";
import {
  useForegroundScreen,
  useScreenClock,
} from "../../shared/hooks/useForegroundScreen";
import { useCivicTheme } from "../../shared/theme/useCivicTheme";
import { getOfficerRoute } from "../api/officerRouting";
import {
  OfficerHeader,
  officerStyles as s,
} from "../components/OfficerUI";
import { OfficerTaskCard } from "../components/OfficerTaskCard";
import { OfficerTaskFilters } from "../components/OfficerTaskFilters";
import { Button } from "../../shared/components/ui/Button";
import { getGeoJsonMapCoordinates, openGoogleMaps } from "../../shared/utils/maps";
import {
  filterOfficerTasks,
  getOfficerTaskState,
  officerErrorMessage,
  type OfficerTaskFilter,
} from "../utils/officerWorkflow";
import { searchOfficerTasks } from "../utils/officerPresentation";
import { useReducedMotion } from "../../shared/hooks/useReducedMotion";
import type {
  OfficerStackParamList,
  OfficerTabParamList,
} from "../../app/navigation/types";

export function OfficerOperationalMap() {
  const { colors, isDark } = useCivicTheme();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<OfficerStackParamList>>();
  const screenRoute =
    useRoute<RouteProp<OfficerTabParamList, "OfficerMapTab">>();
  const query = useOfficerTasks(1, 100, undefined, { allPages: true });
  const gps = useOfficerPosition();
  const foreground = useForegroundScreen();
  const follow = useOfficerMapFollow(foreground);
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
  const followCamera = useRef(new FollowCameraGate());
  const exploring = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const gestureVersion = useRef(0);
  const requestedAtGesture = useRef(0);
  const fittedRoute = useRef<unknown>(null);
  const lastSelection = useRef("");
  const centeredSelection = useRef("");
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
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const pauseFollow = () => {
    exploring.current = true;
    gestureVersion.current += 1;
    follow.pause();
    followCamera.current.reset();
  };
  const startFollow = (mode: "location" | "heading") => {
    exploring.current = false;
    followCamera.current.reset();
    follow.start(mode);
  };
  const onMapTouchMove = (event: GestureResponderEvent) => {
    const { pageX, pageY, touches } = event.nativeEvent;
    const start = touchStart.current;
    if (
      touches?.length > 1 ||
      (start && Math.hypot(pageX - start.x, pageY - start.y) > 6)
    )
      pauseFollow();
  };
  useEffect(() => {
    if (screenRoute.params?.selectedId) {
      setSelectedId(screenRoute.params.selectedId);
      setFilter("ALL");
      setSearch("");
    }
  }, [screenRoute.params?.selectedId]);
  useEffect(() => {
    const key = `${selected?._id}:${destination?.latitude}:${destination?.longitude}`;
    if (lastSelection.current !== key) {
      if (lastSelection.current) {
        setRouteRequested(false);
        fittedRoute.current = null;
        exploring.current = true;
        follow.pause();
      }
      lastSelection.current = key;
    }
    if (!mapReady || centeredSelection.current === key || routeRequested)
      return;
    centeredSelection.current = key;
    if (destination)
      map.current?.animateToRegion(
        { ...destination, latitudeDelta: 0.008, longitudeDelta: 0.008 },
        reducedMotion ? 0 : 300,
      );
  }, [
    selected?._id,
    destination?.latitude,
    destination?.longitude,
    mapReady,
    follow.pause,
    reducedMotion,
    routeRequested,
  ]);
  useEffect(() => {
    if (
      !mapReady ||
      mapHeight <= 0 ||
      !routeRequested ||
      !route.data ||
      fittedRoute.current === route.data
    )
      return;
    fittedRoute.current = route.data;
    // Do not steal the camera if the officer explored while the route was loading,
    // or explicitly enabled following. Layout changes never refit this response.
    if (
      gestureVersion.current !== requestedAtGesture.current ||
      follow.mode !== "off"
    )
      return;
    map.current?.fitToCoordinates(route.data.points, {
      edgePadding: {
        top: Math.min(130, Math.round(mapHeight * 0.3)),
        left: 24,
        right: 48,
        bottom: Math.min(70, Math.round(mapHeight * 0.15)),
      },
      animated: false,
    });
  }, [mapReady, mapHeight, route.data, routeRequested, follow.mode]);
  useEffect(() => {
    if (!foreground || !mapReady || exploring.current) return;
    const camera = followCamera.current.next(
      follow.position,
      follow.heading,
      follow.mode,
    );
    if (camera)
      map.current?.animateCamera(camera, { duration: reducedMotion ? 0 : 450 });
  }, [
    foreground,
    mapReady,
    follow.mode,
    follow.position,
    follow.heading,
    reducedMotion,
  ]);
  const livePosition =
    foreground && follow.position && validMapFix(follow.position)
      ? follow.position.coords
      : null;
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
  const zoom = (factor: number) => {
    pauseFollow();
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
  };
  const controls = [
    {
      label: "Theo vị trí GPS của tôi",
      icon: Crosshair,
      selected: follow.mode === "location",
      press: () => startFollow("location"),
    },
    {
      label: "Theo hướng di chuyển",
      icon: Navigation2,
      selected: follow.mode === "heading",
      press: () =>
        follow.mode === "heading" ? pauseFollow() : startFollow("heading"),
    },
    {
      label: "La bàn: trở về hướng Bắc",
      icon: Compass,
      press: () => {
        pauseFollow();
        map.current?.animateCamera(
          { heading: 0, pitch: 0 },
          { duration: reducedMotion ? 0 : 300 },
        );
      },
    },
    {
      label: "Về vị trí nhiệm vụ",
      icon: Flag,
      press: () => {
        pauseFollow();
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
          scrollEnabled
          zoomEnabled
          rotateEnabled
          pitchEnabled
          scrollDuringRotateOrZoomEnabled
          // One explicit cross-provider compass button also pauses heading-follow.
          showsCompass={false}
          onPanDrag={pauseFollow}
          onTouchStart={(event) => {
            touchStart.current = {
              x: event.nativeEvent.pageX,
              y: event.nativeEvent.pageY,
            };
            if (event.nativeEvent.touches?.length > 1) pauseFollow();
          }}
          onTouchMove={onMapTouchMove}
          onTouchEnd={() => {
            touchStart.current = null;
          }}
          onTouchCancel={() => {
            touchStart.current = null;
          }}
          onRegionChangeComplete={(next) => {
            region.current = next;
          }}
          onMapReady={() => {
            setMapReady(true);
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
          {(livePosition || (gps.position && fresh)) && (
            <Marker
              coordinate={(livePosition || gps.position)!}
              title={
                livePosition ? "Vị trí GPS đang theo dõi" : "Vị trí GPS vừa lấy"
              }
              pinColor="#22C55E"
            />
          )}
          {routeRequested && route.data && (
            <Polyline
              coordinates={route.data.points}
              strokeColor="#38BDF8"
              strokeWidth={5}
            />
          )}
        </MapView>
        <View
          pointerEvents="box-none"
          style={{ position: "absolute", top: 12, left: 12, right: 12, gap: 8 }}
        >
          <View
            pointerEvents="box-none"
            style={[
              s.row,
              {
                borderRadius: 14,
                backgroundColor: colors.surface,
                paddingHorizontal: 12,
              },
            ]}
          >
            {/* <Search pointerEvents="none" color={colors.cyan} size={17} />
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
            /> */}
          </View>
          {/* Bound the horizontal ScrollView: its default flex must not form
              a full-height touch surface above the native map on iOS. */}
          <View pointerEvents="box-none" style={{ height: 44 }}>
            <OfficerTaskFilters
              tasks={tasks}
              value={filter}
              onChange={setFilter}
            />
          </View>
        </View>
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            right: 12,
            bottom: 12,
            flexDirection: mapHeight < 400 ? "row" : "column",
            flexWrap: "wrap",
            maxWidth: "90%",
            justifyContent: "flex-end",
            gap: 6,
          }}
        >
          {controls.map(
            ({ label, icon: Icon, press, selected: activeControl }) => (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: activeControl === true }}
                onPress={() => void press()}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon
                  pointerEvents="none"
                  size={18}
                  color={activeControl ? colors.primary : colors.cyan}
                />
              </Pressable>
            ),
          )}
        </View>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            maxWidth: "55%",
            borderRadius: 10,
            padding: 6,
            backgroundColor: colors.surface,
          }}
        >
          <Text style={[s.meta, { color: colors.cyan }]}>
            {follow.mode === "off"
              ? "Khám phá bản đồ"
              : follow.mode === "location"
                ? "Theo vị trí"
                : follow.heading === null
                  ? "Theo hướng · chờ hướng hợp lệ"
                  : "Theo hướng di chuyển"}
          </Text>
        </View>
        {(query.isLoading ||
          gps.pending ||
          route.isFetching ||
          follow.pending) && (
          <ActivityIndicator
            pointerEvents="none"
            accessibilityLabel="Đang tải bản đồ, GPS hoặc tuyến đường"
            style={{ position: "absolute", bottom: 52, left: 16 }}
            color={colors.primary}
          />
        )}
      </View>
      <ScrollView
        style={{ maxHeight: 250, flexGrow: 0, backgroundColor: colors.surface }}
        contentContainerStyle={{ padding: 12, gap: 8 }}
      >
        {follow.error && (
          <Text
            accessibilityRole="alert"
            style={[s.meta, { color: colors.warning }]}
          >
            {follow.error}
          </Text>
        )}
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
            {routeRequested && route.data && (
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
                    pauseFollow();
                    requestedAtGesture.current = gestureVersion.current;
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
