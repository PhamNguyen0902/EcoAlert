import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { Crosshair, MapPin } from "lucide-react-native";
import { fieldColors as c } from "./fieldDesign";

const darkMap = [
  { elementType: "geometry", stylers: [{ color: "#101D2C" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#74879B" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0B1628" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#233449" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#092536" }],
  },
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
];

/** A read-only view of the actual device fix, not another location picker. */
export function FieldMapPreview({
  location,
  loading,
}: {
  location?: { latitude: number; longitude: number; accuracyMeters: number };
  loading: boolean;
}) {
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const { width } = useWindowDimensions();
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(timer);
  }, []);
  const center = location
    ? {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      }
    : null;
  return (
    <View
      style={[
        styles.frame,
        { height: Math.min(240, Math.max(190, width * 0.6)) },
      ]}
    >
      {center ? (
        <MapView
          ref={map}
          style={StyleSheet.absoluteFill}
          provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
          region={center}
          userInterfaceStyle="dark"
          customMapStyle={darkMap}
          scrollEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          zoomEnabled={false}
          toolbarEnabled={false}
          // Android readiness only initializes the map; wait for tiles before
          // removing the loading state. MapKit has no onMapLoaded callback.
          onMapReady={() => {
            if (Platform.OS !== "android") setReady(true);
          }}
          onMapLoaded={() => setReady(true)}
          loadingEnabled
          loadingBackgroundColor={c.surface}
          loadingIndicatorColor={c.primary}
        >
          <Circle
            center={center}
            radius={Math.max(1, location!.accuracyMeters)}
            strokeColor="rgba(34,197,94,0.55)"
            fillColor="rgba(34,197,94,0.13)"
          />
          <Marker coordinate={center} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.halo}>
              <View style={styles.dot} />
            </View>
          </Marker>
        </MapView>
      ) : (
        <View style={styles.empty}>
          <MapPin size={30} color={c.muted} />
          <Text style={styles.hint}>
            {loading
              ? "Đang chờ vị trí GPS thực…"
              : "Chưa có vị trí để hiển thị bản đồ"}
          </Text>
        </View>
      )}
      {center && !ready ? (
        <View style={styles.empty}>
          <ActivityIndicator color={c.primary} />
          <Text style={styles.hint}>
            {slow
              ? "Bản đồ tải chậm. Kiểm tra kết nối mạng."
              : "Đang tải bản đồ…"}
          </Text>
        </View>
      ) : null}
      {location ? (
        <>
          <Text style={styles.coordinates}>
            {location.latitude.toFixed(6)}°, {location.longitude.toFixed(6)}°
          </Text>
          <Text style={styles.radius}>
            ◎ Bán kính: ±{Math.round(location.accuracyMeters)}m
          </Text>
          <Pressable
            style={styles.recenter}
            accessibilityRole="button"
            accessibilityLabel="Căn giữa vị trí GPS"
            onPress={() => {
              if (center) map.current?.animateToRegion(center, 250);
            }}
          >
            <Crosshair size={20} color={c.primary} />
          </Pressable>
        </>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  frame: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  empty: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: c.surface,
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    color: c.muted,
    paddingHorizontal: 20,
    textAlign: "center",
  },
  halo: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(34,197,94,0.16)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.3)",
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: c.primary,
    borderWidth: 3,
    borderColor: "#9AF2B9",
  },
  coordinates: {
    position: "absolute",
    top: 10,
    left: 10,
    color: c.secondary,
    fontSize: 10,
    lineHeight: 16,
    backgroundColor: "rgba(7,16,31,0.85)",
    padding: 6,
    borderRadius: 6,
  },
  radius: {
    position: "absolute",
    bottom: 10,
    left: 10,
    color: c.cyan,
    fontSize: 10,
    lineHeight: 16,
    backgroundColor: "rgba(7,16,31,0.85)",
    padding: 6,
    borderRadius: 6,
  },
  recenter: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(7,16,31,0.85)",
  },
});
