import { Linking, Platform } from "react-native";

export interface MapCoordinates {
  latitude: number;
  longitude: number;
}

export type GoogleMapsAction = "view" | "navigate";

export type OpenGoogleMapsResult =
  | {
      success: true;
      url: string;
      usedBrowserFallback: boolean;
    }
  | {
      success: false;
      reason: "invalid_coordinates" | "open_failed";
      url?: string;
    };

export const isValidMapCoordinates = (
  latitude: unknown,
  longitude: unknown,
): boolean =>
  typeof latitude === "number" &&
  Number.isFinite(latitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  typeof longitude === "number" &&
  Number.isFinite(longitude) &&
  longitude >= -180 &&
  longitude <= 180;

export const getGeoJsonMapCoordinates = (
  coordinates: readonly unknown[] | null | undefined,
): MapCoordinates | null => {
  const longitude = coordinates?.[0];
  const latitude = coordinates?.[1];

  return isValidMapCoordinates(latitude, longitude)
    ? { latitude: latitude as number, longitude: longitude as number }
    : null;
};

export const buildGoogleMapsUrl = (
  latitude: unknown,
  longitude: unknown,
  action: GoogleMapsAction = "navigate",
): string | null => {
  if (!isValidMapCoordinates(latitude, longitude)) return null;

  const destination = `${latitude},${longitude}`;
  return action === "view"
    ? `https://www.google.com/maps/search/?api=1&query=${destination}`
    : `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=two-wheeler&dirflg=m`;
};

export const getNativeGoogleMapsUrl = (
  latitude: unknown,
  longitude: unknown,
  action: GoogleMapsAction = "navigate",
): string | null => {
  if (!isValidMapCoordinates(latitude, longitude) || action !== "navigate") {
    return null;
  }

  if (Platform.OS === "android") {
    return `google.navigation:q=${latitude},${longitude}&mode=l`;
  }

  if (Platform.OS === "ios") {
    return `comgooglemaps://?daddr=${latitude},${longitude}&directionsmode=two-wheeler`;
  }

  return null;
};

export const openGoogleMaps = async (
  latitude: unknown,
  longitude: unknown,
  action: GoogleMapsAction = "navigate",
): Promise<OpenGoogleMapsResult> => {
  if (!isValidMapCoordinates(latitude, longitude)) {
    return { success: false, reason: "invalid_coordinates" };
  }

  const webUrl = buildGoogleMapsUrl(latitude, longitude, action);
  if (!webUrl) return { success: false, reason: "invalid_coordinates" };

  const nativeUrl = getNativeGoogleMapsUrl(latitude, longitude, action);
  if (nativeUrl) {
    try {
      const canOpenNative = await Linking.canOpenURL(nativeUrl);
      if (canOpenNative) {
        await Linking.openURL(nativeUrl);
        return {
          success: true,
          url: nativeUrl,
          usedBrowserFallback: false,
        };
      }
    } catch {
      // Continue to universal HTTPS URL fallback
    }
  }

  let canOpenDirectly = false;
  try {
    canOpenDirectly = await Linking.canOpenURL(webUrl);
  } catch {
    // Continue with the HTTPS URL so the operating system can use its browser fallback.
  }

  try {
    await Linking.openURL(webUrl);
    return {
      success: true,
      url: webUrl,
      usedBrowserFallback: !canOpenDirectly,
    };
  } catch {
    return { success: false, reason: "open_failed", url: webUrl };
  }
};
