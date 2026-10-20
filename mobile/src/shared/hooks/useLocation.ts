import { useState, useCallback, useRef } from "react";
import * as Location from "expo-location";
import { GeoLocation } from "../types";
import {
  defaultReverseGeocoder,
  ReverseGeocoder,
} from "../services/reverseGeocoder";

export type LocationSource = "device" | "manual" | null;

interface LocationFetchOptions {
  timeoutMs?: number;
  /** Camera capture needs the device fix immediately; address resolution can follow. */
  deferAddress?: boolean;
}

async function withLocationTimeout<T>(operation: Promise<T>, timeoutMs?: number): Promise<T> {
  if (!timeoutMs) return operation;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("GPS_TIMEOUT")), timeoutMs);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

export interface LocationState {
  coords: GeoLocation | null;
  address: string;
  accuracyMeters: number | null;
  capturedAt: string | null;
  source: LocationSource;
  loading: boolean;
  error: string | null;
  errorCode: "PERMISSION_DENIED" | "UNAVAILABLE" | null;
  addressResolved: boolean;
}

export const useLocation = (
  reverseGeocoder: ReverseGeocoder = defaultReverseGeocoder,
) => {
  const requestId = useRef(0);
  const [state, setState] = useState<LocationState>({
    coords: null,
    address: "",
    accuracyMeters: null,
    capturedAt: null,
    source: null,
    loading: false,
    error: null,
    errorCode: null,
    addressResolved: false,
  });

  const fetchLocation = useCallback(async (options: LocationFetchOptions = {}) => {
    const currentRequest = ++requestId.current;
    setState((prev) => ({ ...prev, loading: true, error: null, errorCode: null }));
    try {
      const { status } = await withLocationTimeout(Location.requestForegroundPermissionsAsync(), options.timeoutMs);
      if (currentRequest !== requestId.current) return null;
      if (status !== "granted") {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Permission to access location was denied. Please enable GPS in settings.",
          errorCode: "PERMISSION_DENIED",
        }));
        return null;
      }

      // Field reports favor the freshest and most accurate device fix available.
      const location = await withLocationTimeout(Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      }), options.timeoutMs);
      if (currentRequest !== requestId.current) return null;

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
      let addressResolved = false;
      const fix = { coords, address: addressStr, accuracyMeters, capturedAt, source: "device" as const, addressResolved };
      if (options.deferAddress) {
        setState({ ...fix, loading: false, error: null, errorCode: null });
        void reverseGeocoder.reverseGeocode(location.coords.latitude, location.coords.longitude)
          .then(address => {
            if (address && currentRequest === requestId.current) {
              setState(previous => ({ ...previous, address, addressResolved: true }));
            }
          }).catch(() => undefined);
        return fix;
      }
      try {
        const resolvedAddress = await reverseGeocoder.reverseGeocode(
          location.coords.latitude,
          location.coords.longitude,
        );
        if (resolvedAddress) {
          addressStr = resolvedAddress;
          addressResolved = true;
        }
      } catch {
        // Fallback to coordinates string.
      }

      if (currentRequest !== requestId.current) return null;

      setState({
        coords,
        address: addressStr,
        accuracyMeters,
        capturedAt,
        source: "device",
        loading: false,
        error: null,
        errorCode: null,
        addressResolved,
      });

      return {
        coords,
        address: addressStr,
        accuracyMeters,
        capturedAt,
        source: "device" as const,
        addressResolved,
      };
    } catch (error: unknown) {
      if (currentRequest !== requestId.current) return null;
      const message = error instanceof Error ? error.message : "Failed to retrieve location";
      setState((prev) => ({
        ...prev,
        loading: false,
        error: message,
        errorCode: "UNAVAILABLE",
      }));
      return null;
    }
  }, [reverseGeocoder]);

  // Kept for screens that still support choosing a map coordinate. Field-capture
  // reporting can reject this source and require a fresh `device` location instead.
  const setManualLocation = useCallback((latitude: number, longitude: number, address?: string) => {
    requestId.current += 1;
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
      errorCode: null,
      addressResolved: Boolean(address),
    }));
  }, []);

  return {
    ...state,
    fetchLocation,
    setManualLocation,
  };
};
