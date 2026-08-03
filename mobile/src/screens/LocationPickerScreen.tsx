import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import MapView, { Marker, Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Check, MapPin } from "lucide-react-native";
import { useLocation } from "../hooks/useLocation";
import { defaultReverseGeocoder } from "../services/reverseGeocoder";
import type { CitizenStackParamList, LocationSelection } from "../navigation/types";
import { Button } from "../components/ui/Button";
import { useTheme } from "../context/ThemeContext";

type Props = NativeStackScreenProps<CitizenStackParamList, "LocationPicker">;

const DEFAULT_REGION: Region = {
  latitude: 10.762622,
  longitude: 106.660172,
  latitudeDelta: 0.015,
  longitudeDelta: 0.015,
};

const regionFor = (latitude: number, longitude: number): Region => ({
  latitude,
  longitude,
  latitudeDelta: 0.015,
  longitudeDelta: 0.015,
});

const coordinateAddress = (latitude: number, longitude: number): string =>
  `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

export const LocationPickerScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const mapRef = useRef<MapView>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeRequestId = useRef(0);
  const hasAnimatedInitialRegion = useRef(false);
  const hasAppliedCurrentLocation = useRef(false);
  const initialLocation = route.params.initialLocation;
  const {
    coords: currentCoords,
    address: currentAddress,
    fetchLocation,
  } = useLocation();
  const [selection, setSelection] = useState<LocationSelection>(() =>
    initialLocation ?? {
      latitude: DEFAULT_REGION.latitude,
      longitude: DEFAULT_REGION.longitude,
      address: coordinateAddress(DEFAULT_REGION.latitude, DEFAULT_REGION.longitude),
    },
  );
  const [isFindingAddress, setIsFindingAddress] = useState(false);

  const scheduleReverseGeocode = useCallback((latitude: number, longitude: number) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    const requestId = geocodeRequestId.current + 1;
    geocodeRequestId.current = requestId;
    setIsFindingAddress(true);
    setSelection((previous) => ({ ...previous, latitude, longitude }));

    debounceTimer.current = setTimeout(async () => {
      const resolvedAddress = await defaultReverseGeocoder.reverseGeocode(latitude, longitude);

      if (geocodeRequestId.current !== requestId) {
        return;
      }

      setSelection((previous) => ({
        ...previous,
        address: resolvedAddress ?? coordinateAddress(latitude, longitude),
      }));
      setIsFindingAddress(false);
    }, 500);
  }, []);

  const moveToCoordinate = useCallback(
    (latitude: number, longitude: number, animate = true) => {
      if (animate) {
        mapRef.current?.animateToRegion(regionFor(latitude, longitude), 250);
      }
      scheduleReverseGeocode(latitude, longitude);
    },
    [scheduleReverseGeocode],
  );

  useEffect(() => {
    if (!initialLocation) {
      void fetchLocation();
    }
  }, [fetchLocation, initialLocation]);

  useEffect(() => {
    if (hasAnimatedInitialRegion.current) {
      return;
    }

    if (initialLocation) {
      hasAnimatedInitialRegion.current = true;
      moveToCoordinate(initialLocation.latitude, initialLocation.longitude, false);
      return;
    }

    if (currentCoords) {
      hasAnimatedInitialRegion.current = true;
      hasAppliedCurrentLocation.current = true;
      const [longitude, latitude] = currentCoords.coordinates;

      setSelection({
        latitude,
        longitude,
        address: currentAddress ?? coordinateAddress(latitude, longitude),
      });

      moveToCoordinate(latitude, longitude, false);
    }
  }, [currentAddress, currentCoords, initialLocation, moveToCoordinate]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      geocodeRequestId.current += 1;
    };
  }, []);

  const handleRegionChangeComplete = (region: Region) => {
    scheduleReverseGeocode(region.latitude, region.longitude);
  };

  const handleConfirm = () => {
    navigation.navigate("CitizenTabs", {
      screen: "ReportTab",
      params: { selectedLocation: selection },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={regionFor(selection.latitude, selection.longitude)}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        <Marker 
          coordinate={{ latitude: selection.latitude, longitude: selection.longitude }} 
          pinColor={colors.primary} 
        />
      </MapView>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Cancel location selection"
        onPress={() => navigation.goBack()}
        style={[styles.backButton, { top: insets.top + 12, backgroundColor: colors.surface }]}
      >
        <ArrowLeft size={22} color={colors.text} />
      </TouchableOpacity>

      <View pointerEvents="none" style={styles.crosshair}>
        <View style={[styles.crosshairHorizontal, { backgroundColor: colors.destructive }]} />
        <View style={[styles.crosshairVertical, { backgroundColor: colors.destructive }]} />
        <View style={[styles.crosshairCenter, { backgroundColor: colors.surface, borderColor: colors.destructive }]} />
      </View>

      <View style={[styles.bottomArea, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={[styles.addressCard, { backgroundColor: colors.surface }]}>
          <View style={styles.addressHeader}>
            <MapPin size={18} color={colors.primary} />
            <Text style={[styles.addressLabel, { color: colors.text }]}>Current Address</Text>
          </View>

          {isFindingAddress ? (
            <View style={styles.findingAddress}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.findingAddressText, { color: colors.textMuted }]}>Finding address...</Text>
            </View>
          ) : (
            <Text style={[styles.address, { color: colors.text }]} numberOfLines={3}>
              {selection.address}
            </Text>
          )}

          <View style={styles.coordinateRow}>
            <Text style={[styles.coordinateLabel, { color: colors.textMuted }]}>Latitude:</Text>
            <Text style={[styles.coordinateValue, { color: colors.text }]}>{selection.latitude.toFixed(6)}</Text>
          </View>
          <View style={styles.coordinateRow}>
            <Text style={[styles.coordinateLabel, { color: colors.textMuted }]}>Longitude:</Text>
            <Text style={[styles.coordinateValue, { color: colors.text }]}>{selection.longitude.toFixed(6)}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            title="Cancel"
            variant="outline"
            onPress={() => navigation.goBack()}
            style={[styles.cancelButton, { backgroundColor: colors.surface }]}
          />
          <Button
            title="Confirm Location"
            onPress={handleConfirm}
            icon={<Check size={18} color="#FFF" style={styles.confirmIcon} />}
            style={styles.confirmButton}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  backButton: {
    position: "absolute",
    left: 16,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  crosshair: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 32,
    height: 32,
    marginLeft: -16,
    marginTop: -16,
    alignItems: "center",
    justifyContent: "center",
  },
  crosshairHorizontal: {
    position: "absolute",
    width: 28,
    height: 2,
    borderRadius: 2,
  },
  crosshairVertical: {
    position: "absolute",
    width: 2,
    height: 28,
    borderRadius: 2,
  },
  crosshairCenter: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
  },
  bottomArea: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 0,
    gap: 12,
  },
  addressCard: {
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 8,
  },
  addressHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: "800",
  },
  address: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
  },
  findingAddress: {
    minHeight: 47,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  findingAddressText: {
    fontSize: 14,
    fontWeight: "600",
  },
  coordinateRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  coordinateLabel: {
    width: 88,
    fontSize: 13,
    fontWeight: "600",
  },
  coordinateValue: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
  },
  confirmButton: {
    flex: 1.4,
  },
  confirmIcon: {
    marginRight: 8,
  },
});
