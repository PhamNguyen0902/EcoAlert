const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const CACHE_LIMIT = 50;
const REQUEST_TIMEOUT_MS = 8_000;
const MIN_REQUEST_INTERVAL_MS = 1_000;

export interface ReverseGeocoder {
  reverseGeocode(latitude: number, longitude: number): Promise<string | null>;
}

type NominatimAddress = Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const nonEmptyString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const joinAddressParts = (parts: Array<string | null>): string | null => {
  const address = Array.from(new Set(parts.filter((part): part is string => Boolean(part)))).join(', ');
  return address || null;
};

const formatNominatimAddress = (address: NominatimAddress): string | null => {
  const street = [nonEmptyString(address.house_number), nonEmptyString(address.road)]
    .filter((part): part is string => Boolean(part))
    .join(' ');

  return joinAddressParts([
    street || null,
    nonEmptyString(address.neighbourhood),
    nonEmptyString(address.suburb),
    nonEmptyString(address.city_district),
    nonEmptyString(address.city),
    nonEmptyString(address.town),
    nonEmptyString(address.village),
    nonEmptyString(address.state),
    nonEmptyString(address.country),
  ]);
};

const coordinateKey = (latitude: number, longitude: number): string =>
  `${latitude.toFixed(5)},${longitude.toFixed(5)}`;

const hasValidCoordinates = (latitude: number, longitude: number): boolean =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  longitude >= -180 &&
  longitude <= 180;

export class NominatimReverseGeocoder implements ReverseGeocoder {
  private requestQueue: Promise<void> = Promise.resolve();
  private nextRequestAt = 0;

  async reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
    if (!hasValidCoordinates(latitude, longitude)) {
      return null;
    }

    const url = `${NOMINATIM_REVERSE_URL}?format=json&lat=${encodeURIComponent(
      String(latitude),
    )}&lon=${encodeURIComponent(String(longitude))}&zoom=18&addressdetails=1`;

    try {
      await this.waitForRequestSlot();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          return null;
        }

        const payload: unknown = await response.json();
        if (!isRecord(payload)) {
          return null;
        }

        if (isRecord(payload.address)) {
          return formatNominatimAddress(payload.address) ?? nonEmptyString(payload.display_name);
        }

        return nonEmptyString(payload.display_name);
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
      this.nextRequestAt = Date.now() + MIN_REQUEST_INTERVAL_MS;
    });

    this.requestQueue = scheduledRequest.catch(() => undefined);
    return scheduledRequest;
  }
}

export class CachedReverseGeocoder implements ReverseGeocoder {
  private readonly cache = new Map<string, string>();
  private readonly inFlightRequests = new Map<string, Promise<string | null>>();

  constructor(private readonly geocoder: ReverseGeocoder) {}

  reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
    const key = coordinateKey(latitude, longitude);
    const cachedAddress = this.cache.get(key);
    if (cachedAddress) {
      this.cache.delete(key);
      this.cache.set(key, cachedAddress);
      return Promise.resolve(cachedAddress);
    }

    const inFlightRequest = this.inFlightRequests.get(key);
    if (inFlightRequest) {
      return inFlightRequest;
    }

    const request = this.geocoder
      .reverseGeocode(latitude, longitude)
      .then((address) => {
        if (address) {
          this.cache.set(key, address);
          if (this.cache.size > CACHE_LIMIT) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) {
              this.cache.delete(oldestKey);
            }
          }
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

export const reverseGeocoder: ReverseGeocoder = new CachedReverseGeocoder(
  new NominatimReverseGeocoder(),
);
