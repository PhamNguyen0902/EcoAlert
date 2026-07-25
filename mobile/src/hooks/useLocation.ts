import { useState, useCallback } from "react";
import * as Location from "expo-location";
import { GeoLocation } from "../types";

export interface LocationState {
  coords: GeoLocation | null;
  address: string;
  loading: boolean;
  error: string | null;
}

export const useLocation = () => {
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

      // Try reverse geocoding to get human-readable address
      let addressStr = `${location.coords.latitude.toFixed(5)}, ${location.coords.longitude.toFixed(5)}`;
      try {
        const reverse = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        if (reverse && reverse.length > 0) {
          const item = reverse[0];
          const parts = [item.streetNumber, item.street, item.city, item.region].filter(Boolean);
          if (parts.length > 0) {
            addressStr = parts.join(", ");
          }
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
  }, []);

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
