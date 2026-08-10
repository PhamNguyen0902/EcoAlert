import { format } from "date-fns";

export interface WatermarkData {
  latitude?: number;
  longitude?: number;
  address?: string;
  timestamp?: Date;
  brandTag?: string;
}

export interface FormattedWatermark {
  dateTimeStr: string;
  locationStr: string;
  addressStr: string;
  brandStr: string;
}

/**
 * Formats watermark information for overlaying on photos.
 */
export function formatWatermarkData(data: WatermarkData): FormattedWatermark {
  const date = data.timestamp || new Date();
  const dateTimeStr = format(date, "yyyy-MM-dd HH:mm:ss");

  let locationStr = "GPS: Unavailable";
  if (typeof data.latitude === "number" && typeof data.longitude === "number") {
    locationStr = `GPS: ${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`;
  }

  const addressStr = data.address ? data.address.trim() : "Location: Unspecified";
  const brandStr = data.brandTag || "EcoAlert Verified Incident";

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
