import { useState, useCallback } from "react";
import * as Location from "expo-location";
import { GeoLocation } from "../types";
import {
  defaultReverseGeocoder,
  ReverseGeocoder,
} from "../services/reverseGeocoder";

export type LocationSource = "device" | "manual" | null;

export interface LocationState {
  coords: GeoLocation | null;
  address: string;
  accuracyMeters: number | null;
  capturedAt: string | null;
  source: LocationSource;
  loading: boolean;
  error: string | null;
}

export const useLocation = (
  reverseGeocoder: ReverseGeocoder = defaultReverseGeocoder,
) => {
  const [state, setState] = useState<LocationState>({
    coords: null,
    address: "",
    accuracyMeters: null,
    capturedAt: null,
    source: null,
    loading: false,
    error: null,
  });

  const fetchLocation = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Permission to access location was denied. Please enable GPS in settings.",
        }));
        return null;
      }

      // Field reports favor the freshest and most accurate device fix available.
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      const coords: GeoLocation = {
        type: "Point",
        coordinates: [location.coords.longitude, location.coords.latitude],
      };
      const accuracyMeters =
        typeof location.coords.accuracy === "number" && Number.isFinite(location.coords.accuracy)
          ? Math.max(0, location.coords.accuracy)
          : null;
      const capturedAt = new Date(location.timestamp || Date.now()).toISOString();

      // Reverse geocoding failures leave the already-available coordinates as the address.
      let addressStr = `${location.coords.latitude.toFixed(5)}, ${location.coords.longitude.toFixed(5)}`;
      try {
        const resolvedAddress = await reverseGeocoder.reverseGeocode(
          location.coords.latitude,
          location.coords.longitude,
        );
        if (resolvedAddress) {
          addressStr = resolvedAddress;
        }
      } catch {
        // Fallback to coordinates string.
      }

      setState({
        coords,
        address: addressStr,
        accuracyMeters,
        capturedAt,
        source: "device",
        loading: false,
        error: null,
      });

      return {
        coords,
        address: addressStr,
        accuracyMeters,
        capturedAt,
        source: "device" as const,
      };
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || "Failed to retrieve location",
      }));
      return null;
    }
  }, [reverseGeocoder]);

  // Kept for screens that still support choosing a map coordinate. Field-capture
  // reporting can reject this source and require a fresh `device` location instead.
  const setManualLocation = useCallback((latitude: number, longitude: number, address?: string) => {
    const coords: GeoLocation = {
      type: "Point",
      coordinates: [longitude, latitude],
    };
    setState((prev) => ({
      ...prev,
      coords,
      address: address || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      accuracyMeters: null,
      capturedAt: null,
      source: "manual",
      error: null,
    }));
  }, []);

  return {
    ...state,
    fetchLocation,
    setManualLocation,
  };
};
