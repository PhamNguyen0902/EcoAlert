import * as Location from "expo-location";

const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const NOMINATIM_TIMEOUT_MS = 8_000;
const NOMINATIM_MIN_REQUEST_INTERVAL_MS = 1_000;

export interface ReverseGeocoder {
  reverseGeocode(latitude: number, longitude: number): Promise<string | null>;
}

type AddressRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is AddressRecord =>
  typeof value === "object" && value !== null;

const getNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
};

const joinAddressParts = (parts: Array<string | null | undefined>): string | null => {
  const uniqueParts = new Set<string>();

  for (const part of parts) {
    const value = getNonEmptyString(part);
    if (value) {
      uniqueParts.add(value);
    }
  }

  const address = Array.from(uniqueParts).join(", ");
  return address || null;
};

const joinStreetParts = (houseNumber: unknown, road: unknown): string | null =>
  [getNonEmptyString(houseNumber), getNonEmptyString(road)].filter(
    (part): part is string => Boolean(part),
  ).join(" ") || null;

const formatNominatimAddress = (address: AddressRecord): string | null =>
  joinAddressParts([
    joinStreetParts(address.house_number, address.road),
    getNonEmptyString(address.neighbourhood),
    getNonEmptyString(address.suburb),
    getNonEmptyString(address.city_district),
    getNonEmptyString(address.city),
    getNonEmptyString(address.town),
    getNonEmptyString(address.village),
    getNonEmptyString(address.state),
    getNonEmptyString(address.country),
  ]);

const formatExpoAddress = (address: Location.LocationGeocodedAddress): string | null =>
  joinAddressParts([
    joinStreetParts(address.streetNumber, address.street),
    address.district,
    address.subregion,
    address.city,
    address.region,
    address.country,
  ]);

const isValidCoordinate = (latitude: number, longitude: number): boolean =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  longitude >= -180 &&
  longitude <= 180;

export class NominatimReverseGeocoder implements ReverseGeocoder {
  private requestQueue: Promise<void> = Promise.resolve();
  private nextRequestAt = 0;

  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
    if (!isValidCoordinate(latitude, longitude)) {
      return null;
    }

    try {
      await this.waitForRequestSlot();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);
      const url = `${NOMINATIM_REVERSE_URL}?format=json&lat=${encodeURIComponent(
        String(latitude),
      )}&lon=${encodeURIComponent(String(longitude))}&zoom=18&addressdetails=1`;

      try {
        const response = await this.fetcher(url, {
          headers: {
            "User-Agent": "EcoAlertApp/1.0",
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          return null;
        }

        const payload: unknown = await response.json();
        if (!isRecord(payload) || !isRecord(payload.address)) {
          return null;
        }

        return formatNominatimAddress(payload.address);
      } catch {
        // Network, timeout, and invalid-JSON errors use the Expo fallback.
        return null;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch {
      return null;
    }
  }

  private waitForRequestSlot(): Promise<void> {
    const scheduledRequest = this.requestQueue.then(async () => {
      const waitMs = Math.max(0, this.nextRequestAt - Date.now());
      if (waitMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
      }
      this.nextRequestAt = Date.now() + NOMINATIM_MIN_REQUEST_INTERVAL_MS;
    });

    // A failed request must never prevent later requests from using the provider.
    this.requestQueue = scheduledRequest.catch(() => undefined);
    return scheduledRequest;
  }
}

export class ExpoReverseGeocoder implements ReverseGeocoder {
  async reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
    if (!isValidCoordinate(latitude, longitude)) {
      return null;
    }

    try {
      const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
      return addresses.length > 0 ? formatExpoAddress(addresses[0]) : null;
    } catch {
      return null;
    }
  }
}

export class FallbackReverseGeocoder implements ReverseGeocoder {
  constructor(
    private readonly primary: ReverseGeocoder,
    private readonly fallback: ReverseGeocoder,
  ) {}

  async reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
    try {
      const primaryAddress = await this.primary.reverseGeocode(latitude, longitude);
      if (primaryAddress) {
        return primaryAddress;
      }
    } catch {
      // A custom primary geocoder may throw; always continue to the fallback.
    }

    try {
      return await this.fallback.reverseGeocode(latitude, longitude);
    } catch {
      return null;
    }
  }
}

export class CachedReverseGeocoder implements ReverseGeocoder {
  private lastSuccessfulResult: { key: string; address: string } | null = null;
  private readonly inFlightRequests = new Map<string, Promise<string | null>>();

  constructor(private readonly geocoder: ReverseGeocoder) {}

  reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
    const key = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;

    if (this.lastSuccessfulResult?.key === key) {
      return Promise.resolve(this.lastSuccessfulResult.address);
    }

    const inFlightRequest = this.inFlightRequests.get(key);
    if (inFlightRequest) {
      return inFlightRequest;
    }

    const request = this.geocoder
      .reverseGeocode(latitude, longitude)
      .then((address) => {
        if (address) {
          this.lastSuccessfulResult = { key, address };
        }
        return address;
      })
      .catch(() => null)
      .finally(() => {
        this.inFlightRequests.delete(key);
      });

    this.inFlightRequests.set(key, request);
    return request;
  }
}

export const defaultReverseGeocoder: ReverseGeocoder = new CachedReverseGeocoder(
  new FallbackReverseGeocoder(
    new NominatimReverseGeocoder(),
    new ExpoReverseGeocoder(),
  ),
);
