import { format } from "date-fns";
import * as FileSystem from "expo-file-system/legacy";
import type { Language } from "../context/LanguageContext";

export interface WatermarkData {
  latitude?: number;
  longitude?: number;
  address?: string;
  accuracyMeters?: number;
  timestamp?: Date;
  brandTag?: string;
}

export interface FormattedWatermark {
  dateTimeStr: string;
  locationStr: string;
  addressStr: string;
  brandStr: string;
}

export const formatCaptureTimestamp = (timestamp?: Date): string =>
  format(timestamp || new Date(), "dd/MM/yyyy HH:mm:ss");

export const formatCaptureCoordinates = (
  latitude?: number,
  longitude?: number,
  accuracyMeters?: number,
): string => {
  if (typeof latitude !== "number" || typeof longitude !== "number") return "GPS: Unavailable";
  const accuracy = typeof accuracyMeters === "number" ? ` · ±${Math.round(accuracyMeters)}m` : "";
  return `GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}${accuracy}`;
};

export const formatCaptureAddress = (address?: string): string =>
  address?.trim() || "Địa điểm: Chưa xác định";

/** Moves a rasterized ViewShot result out of the temporary cache for offline sync. */
export const persistWatermarkedDisplayImage = async (
  temporaryUri: string,
  capturedAt: string,
): Promise<string> => {
  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory) throw new Error("Persistent app storage is unavailable");

  const directory = `${documentDirectory}field-evidence/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const safeTimestamp = capturedAt.replace(/[^0-9]/g, "");
  const destinationUri = `${directory}display_${safeTimestamp}_${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: temporaryUri, to: destinationUri });
  return destinationUri;
};

/**
 * Formats field-capture information for overlaying on photos.
 * A capture is not called "verified" until backend/officer checks have completed.
 */
export function formatWatermarkData(data: WatermarkData, language: Language = "vi"): FormattedWatermark {
  const dateTimeStr = `Captured: ${formatCaptureTimestamp(data.timestamp)}`;

  const text = language === "vi"
    ? { gpsUnavailable: "GPS: Không có", addressUnavailable: "Địa điểm: Chưa xác định", brand: "ECOALERT FIELD CAPTURE" }
    : { gpsUnavailable: "GPS: Unavailable", addressUnavailable: "Location: Unspecified", brand: "ECOALERT FIELD CAPTURE" };
  const locationStr = typeof data.latitude === "number" && typeof data.longitude === "number"
    ? formatCaptureCoordinates(data.latitude, data.longitude, data.accuracyMeters)
    : text.gpsUnavailable;

  const addressStr = data.address ? formatCaptureAddress(data.address) : text.addressUnavailable;
  const brandStr = data.brandTag || text.brand;

  return {
    dateTimeStr,
    locationStr,
    addressStr,
    brandStr,
  };
}

/**
 * Returns SVG string representing a watermark overlay badge
 * that can be embedded or rendered.
 */
export function generateWatermarkSvg(
  width: number,
  height: number,
  watermark: FormattedWatermark,
): string {
  const bannerHeight = Math.max(60, Math.round(height * 0.12));
  const fontSizeMain = Math.max(12, Math.round(bannerHeight * 0.22));
  const fontSizeSub = Math.max(10, Math.round(bannerHeight * 0.18));
  const yStart = height - bannerHeight;

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="wmGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="rgba(0,0,0,0.0)" />
          <stop offset="30%" stop-color="rgba(0,0,0,0.65)" />
          <stop offset="100%" stop-color="rgba(0,0,0,0.90)" />
        </linearGradient>
      </defs>
      <rect x="0" y="${yStart}" width="${width}" height="${bannerHeight}" fill="url(#wmGradient)" />
      
      <circle cx="20" cy="${yStart + 22}" r="5" fill="#22C55E" />
      <text x="32" y="${yStart + 25}" font-family="sans-serif" font-size="${fontSizeMain}" font-weight="bold" fill="#22C55E">
        ${escapeXml(watermark.brandStr)}
      </text>

      <text x="20" y="${yStart + 42}" font-family="sans-serif" font-size="${fontSizeSub}" fill="#FFFFFF">
        📅 ${escapeXml(watermark.dateTimeStr)}  |  📍 ${escapeXml(watermark.locationStr)}
      </text>

      ${
        watermark.addressStr
          ? `<text x="20" y="${yStart + 58}" font-family="sans-serif" font-size="${fontSizeSub}" fill="#CBD5E1">
              🏠 ${escapeXml(watermark.addressStr.substring(0, 60))}
            </text>`
          : ""
      }
    </svg>
  `.trim();
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
