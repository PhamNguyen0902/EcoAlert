import { useState, useCallback } from "react";
import * as Location from "expo-location";
import { GeoLocation } from "../types";
import {
  defaultReverseGeocoder,
  ReverseGeocoder,
} from "../services/reverseGeocoder";

export interface LocationState {
  coords: GeoLocation | null;
  address: string;
  loading: boolean;
  error: string | null;
}

export const useLocation = (
  reverseGeocoder: ReverseGeocoder = defaultReverseGeocoder,
) => {
  const [state, setState] = useState<LocationState>({
    coords: null,
    address: "",
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

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords: GeoLocation = {
        type: "Point",
        coordinates: [location.coords.longitude, location.coords.latitude],
      };

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
      } catch (e) {
        // Fallback to coordinates string
      }

      setState({
        coords,
        address: addressStr,
        loading: false,
        error: null,
      });

      return { coords, address: addressStr };
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || "Failed to retrieve location",
      }));
      return null;
    }
  }, [reverseGeocoder]);

  const setManualLocation = useCallback((latitude: number, longitude: number, address?: string) => {
    const coords: GeoLocation = {
      type: "Point",
      coordinates: [longitude, latitude],
    };
    setState((prev) => ({
      ...prev,
      coords,
      address: address || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      error: null,
    }));
  }, []);

  return {
    ...state,
    fetchLocation,
    setManualLocation,
  };
};
