import { AppError, createLogger } from '@ecoalert/shared';
import { envConfig } from '../config/env.config';
import {
  aggregateDailyForecast,
  DailyForecast,
  ForecastPeriod,
  normalizeForecastEntries,
} from './weather-normalization';

const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';
const OPENWEATHER_ICON_URL = 'https://openweathermap.org/img/wn';
const PROVIDER_TIMEOUT_MS = 10_000;

const logger = createLogger('gis-service');

type ProviderEndpointCategory = 'current' | 'forecast' | 'air-quality';
type ProviderErrorType =
  | 'authentication'
  | 'rate-limit'
  | 'http'
  | 'network'
  | 'timeout';

class ProviderRequestError extends Error {
  constructor(
    readonly endpointCategory: ProviderEndpointCategory,
    readonly status: number | null,
    readonly errorType: ProviderErrorType,
  ) {
    super('OpenWeather provider request failed');
    this.name = 'ProviderRequestError';
  }
}

interface OpenWeatherCurrentResponse {
  coord?: { lat?: number; lon?: number };
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
    pressure?: number;
  };
  wind?: { speed?: number; deg?: number };
  clouds?: { all?: number };
  visibility?: number;
  weather?: Array<{ main?: string; description?: string; icon?: string }>;
  sys: {
    sunrise: number;
    sunset: number;
    country?: string;
  };
  timezone?: number;
  name?: string;
}

interface OpenWeatherAirResponse {
  list?: Array<{
    main?: { aqi?: number };
    components?: {
      co?: number;
      no2?: number;
      o3?: number;
      pm2_5?: number;
      pm10?: number;
    };
  }>;
}

interface OpenWeatherForecastResponse {
  list?: unknown;
  city?: {
    name?: string;
    country?: string;
    timezone?: number;
    coord?: { lat?: number; lon?: number };
  };
}

export interface CurrentWeather {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  description: string;
  icon: string;
  sunrise: string;
  sunset: string;
  aqi: number;
  aqiLabel: string;
  lastUpdated: string;
}

export interface WeatherDetails {
  location: {
    name: string;
    country: string;
    latitude: number;
    longitude: number;
    timezoneOffsetSeconds: number;
  };
  current: CurrentWeather & {
    condition: string;
    pressure: number | null;
    visibilityKm: number | null;
    cloudiness: number | null;
  };
  hourly: ForecastPeriod[];
  daily: DailyForecast[];
  airQuality: {
    aqi: number;
    aqiLabel: string;
    pm2_5: number | null;
    pm10: number | null;
    co: number | null;
    no2: number | null;
    o3: number | null;
  } | null;
  availability: {
    forecast: boolean;
    airQuality: boolean;
  };
  fetchedAt: string;
}

const isOpenWeatherCurrentResponse = (
  value: unknown,
): value is OpenWeatherCurrentResponse => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<OpenWeatherCurrentResponse>;
  return (
    typeof candidate.main?.temp === 'number' &&
    Number.isFinite(candidate.main.temp) &&
    typeof candidate.main.feels_like === 'number' &&
    Number.isFinite(candidate.main.feels_like) &&
    typeof candidate.main.humidity === 'number' &&
    Number.isFinite(candidate.main.humidity) &&
    typeof candidate.sys?.sunrise === 'number' &&
    typeof candidate.sys.sunset === 'number'
  );
};

const formatProviderTime = (timestamp: number, timezoneOffset = 0): string => {
  const localDate = new Date((timestamp + timezoneOffset) * 1000);
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(localDate);
};

const fetchProviderJson = async <T>(
  url: URL,
  endpointCategory: ProviderEndpointCategory,
): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const errorType: ProviderErrorType =
        response.status === 401
          ? 'authentication'
          : response.status === 429
            ? 'rate-limit'
            : 'http';
      throw new ProviderRequestError(
        endpointCategory,
        response.status,
        errorType,
      );
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ProviderRequestError) throw error;
    const errorType: ProviderErrorType =
      error instanceof Error && error.name === 'AbortError'
        ? 'timeout'
        : 'network';
    throw new ProviderRequestError(endpointCategory, null, errorType);
  } finally {
    clearTimeout(timeout);
  }
};

const logProviderFailure = (
  operation: string,
  error: unknown,
): void => {
  if (error instanceof ProviderRequestError) {
    logger.warn('OpenWeather provider request failed', {
      operation,
      endpointCategory: error.endpointCategory,
      status: error.status,
      errorType: error.errorType,
    });
    return;
  }

  logger.warn('OpenWeather provider response was invalid', {
    operation,
    errorType: 'invalid-response',
  });
};

const buildProviderUrl = (
  path: 'weather' | 'forecast' | 'air_pollution',
  lat: number,
  lng: number,
  apiKey: string,
): URL => {
  const url = new URL(`${OPENWEATHER_BASE_URL}/${path}`);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('appid', apiKey);
  if (path !== 'air_pollution') url.searchParams.set('units', 'metric');
  return url;
};

const aqiLabel = (aqi: number): string =>
  ['Unknown', 'Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'][aqi] ??
  'Unknown';

const windSpeedKmh = (metersPerSecond?: number): number =>
  typeof metersPerSecond === 'number' && Number.isFinite(metersPerSecond)
    ? Math.round(metersPerSecond * 36) / 10
    : 0;

const iconUrl = (code?: string): string =>
  code ? `${OPENWEATHER_ICON_URL}/${code}@2x.png` : '';

const currentWeatherFromProvider = (
  current: OpenWeatherCurrentResponse,
  air?: OpenWeatherAirResponse,
): CurrentWeather => {
  const aqi = air?.list?.[0]?.main?.aqi ?? 0;
  const weather = current.weather?.[0];

  return {
    temperature: current.main.temp,
    feelsLike: current.main.feels_like,
    humidity: current.main.humidity,
    windSpeed: windSpeedKmh(current.wind?.speed),
    windDirection: current.wind?.deg ?? 0,
    description: weather?.description ?? '',
    icon: iconUrl(weather?.icon),
    sunrise: formatProviderTime(current.sys.sunrise, current.timezone),
    sunset: formatProviderTime(current.sys.sunset, current.timezone),
    aqi,
    aqiLabel: aqiLabel(aqi),
    lastUpdated: new Date().toISOString(),
  };
};

export class WeatherService {
  private getApiKey(): string {
    const apiKey = envConfig.openWeatherApiKey;
    if (!apiKey) {
      logger.error('OPENWEATHER_API_KEY is not configured');
      throw new AppError('Weather service is unavailable', 503);
    }
    return apiKey;
  }

  async getCurrentWeather(lat: number, lng: number): Promise<CurrentWeather> {
    const apiKey = this.getApiKey();

    try {
      const [currentResult, airResult] = await Promise.allSettled([
        fetchProviderJson<unknown>(
          buildProviderUrl('weather', lat, lng, apiKey),
          'current',
        ),
        fetchProviderJson<OpenWeatherAirResponse>(
          buildProviderUrl('air_pollution', lat, lng, apiKey),
          'air-quality',
        ),
      ]);

      if (currentResult.status === 'rejected') throw currentResult.reason;
      if (!isOpenWeatherCurrentResponse(currentResult.value)) {
        throw new Error('OpenWeatherMap returned invalid current weather');
      }
      if (airResult.status === 'rejected') {
        logProviderFailure('current-weather-air-quality', airResult.reason);
      }

      return currentWeatherFromProvider(
        currentResult.value,
        airResult.status === 'fulfilled' ? airResult.value : undefined,
      );
    } catch (error) {
      logProviderFailure('current-weather', error);
      throw new AppError('Weather service is temporarily unavailable', 503);
    }
  }

  async getWeatherDetails(lat: number, lng: number): Promise<WeatherDetails> {
    const apiKey = this.getApiKey();

    try {
      const [currentResult, forecastResult, airResult] = await Promise.allSettled([
        fetchProviderJson<unknown>(
          buildProviderUrl('weather', lat, lng, apiKey),
          'current',
        ),
        fetchProviderJson<OpenWeatherForecastResponse>(
          buildProviderUrl('forecast', lat, lng, apiKey),
          'forecast',
        ),
        fetchProviderJson<OpenWeatherAirResponse>(
          buildProviderUrl('air_pollution', lat, lng, apiKey),
          'air-quality',
        ),
      ]);

      if (currentResult.status === 'rejected') throw currentResult.reason;
      if (!isOpenWeatherCurrentResponse(currentResult.value)) {
        throw new Error('OpenWeatherMap returned invalid current weather');
      }
      if (forecastResult.status === 'rejected') {
        logProviderFailure('weather-details-forecast', forecastResult.reason);
      }
      if (airResult.status === 'rejected') {
        logProviderFailure('weather-details-air-quality', airResult.reason);
      }

      const current = currentResult.value;
      const forecast =
        forecastResult.status === 'fulfilled' ? forecastResult.value : undefined;
      const air = airResult.status === 'fulfilled' ? airResult.value : undefined;
      const timezoneOffsetSeconds =
        forecast?.city?.timezone ?? current.timezone ?? 0;
      const allPeriods = normalizeForecastEntries(forecast?.list);
      const hourly = allPeriods.slice(0, 12);
      const daily = aggregateDailyForecast(
        allPeriods,
        timezoneOffsetSeconds,
        5,
      );
      const airEntry = air?.list?.[0];
      const currentSummary = currentWeatherFromProvider(current, air);
      const weather = current.weather?.[0];

      return {
        location: {
          name: forecast?.city?.name ?? current.name ?? '',
          country: forecast?.city?.country ?? current.sys.country ?? '',
          latitude: forecast?.city?.coord?.lat ?? current.coord?.lat ?? lat,
          longitude: forecast?.city?.coord?.lon ?? current.coord?.lon ?? lng,
          timezoneOffsetSeconds,
        },
        current: {
          ...currentSummary,
          condition: weather?.main ?? '',
          pressure: current.main.pressure ?? null,
          visibilityKm:
            typeof current.visibility === 'number'
              ? Math.round((current.visibility / 1000) * 10) / 10
              : null,
          cloudiness: current.clouds?.all ?? null,
        },
        hourly,
        daily,
        airQuality: airEntry
          ? {
              aqi: airEntry.main?.aqi ?? 0,
              aqiLabel: aqiLabel(airEntry.main?.aqi ?? 0),
              pm2_5: airEntry.components?.pm2_5 ?? null,
              pm10: airEntry.components?.pm10 ?? null,
              co: airEntry.components?.co ?? null,
              no2: airEntry.components?.no2 ?? null,
              o3: airEntry.components?.o3 ?? null,
            }
          : null,
        availability: {
          forecast: forecastResult.status === 'fulfilled' && allPeriods.length > 0,
          airQuality: Boolean(airEntry),
        },
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      logProviderFailure('weather-details', error);
      throw new AppError('Weather service is temporarily unavailable', 503);
    }
  }
}

export const weatherService = new WeatherService();
