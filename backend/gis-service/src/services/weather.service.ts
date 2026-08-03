import { AppError, createLogger } from '@ecoalert/shared';
import { envConfig } from '../config/env.config';

const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';
const OPENWEATHER_ICON_URL = 'https://openweathermap.org/img/wn';
const PROVIDER_TIMEOUT_MS = 10_000;

const logger = createLogger('gis-service');

interface OpenWeatherCurrentResponse {
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
  };
  wind?: {
    speed?: number;
    deg?: number;
  };
  weather?: Array<{
    description?: string;
    icon?: string;
  }>;
  sys: {
    sunrise: number;
    sunset: number;
  };
  timezone?: number;
}

interface OpenWeatherAirResponse {
  list?: Array<{
    main?: {
      aqi?: number;
    };
  }>;
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

const isOpenWeatherCurrentResponse = (
  value: unknown,
): value is OpenWeatherCurrentResponse => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<OpenWeatherCurrentResponse>;
  return (
    typeof candidate.main?.temp === 'number' &&
    typeof candidate.main.feels_like === 'number' &&
    typeof candidate.main.humidity === 'number' &&
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

const fetchProviderJson = async <T>(url: URL): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`OpenWeatherMap returned ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
};

export class WeatherService {
  async getCurrentWeather(lat: number, lng: number): Promise<CurrentWeather> {
    const apiKey = envConfig.openWeatherApiKey;
    if (!apiKey) {
      logger.error('OPENWEATHER_API_KEY is not configured');
      throw new AppError('Weather service is unavailable', 503);
    }

    const currentUrl = new URL(`${OPENWEATHER_BASE_URL}/weather`);
    currentUrl.searchParams.set('lat', String(lat));
    currentUrl.searchParams.set('lon', String(lng));
    currentUrl.searchParams.set('appid', apiKey);
    currentUrl.searchParams.set('units', 'metric');

    const airUrl = new URL(`${OPENWEATHER_BASE_URL}/air_pollution`);
    airUrl.searchParams.set('lat', String(lat));
    airUrl.searchParams.set('lon', String(lng));
    airUrl.searchParams.set('appid', apiKey);

    try {
      const [current, air] = await Promise.all([
        fetchProviderJson<unknown>(currentUrl),
        fetchProviderJson<OpenWeatherAirResponse>(airUrl),
      ]);

      if (!isOpenWeatherCurrentResponse(current)) {
        throw new Error('OpenWeatherMap returned an invalid current-weather response');
      }

      const aqi = air.list?.[0]?.main?.aqi ?? 0;
      const aqiLabels = ['Unknown', 'Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];
      const weather = current.weather?.[0];

      return {
        temperature: current.main.temp,
        feelsLike: current.main.feels_like,
        humidity: current.main.humidity,
        windSpeed: current.wind?.speed ?? 0,
        windDirection: current.wind?.deg ?? 0,
        description: weather?.description ?? '',
        icon: weather?.icon ? `${OPENWEATHER_ICON_URL}/${weather.icon}@2x.png` : '',
        sunrise: formatProviderTime(current.sys.sunrise, current.timezone),
        sunset: formatProviderTime(current.sys.sunset, current.timezone),
        aqi,
        aqiLabel: aqiLabels[aqi] ?? 'Unknown',
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      logger.warn('OpenWeatherMap request failed', {
        error: error instanceof Error ? error.message : 'Unknown provider error',
      });
      throw new AppError('Weather service is temporarily unavailable', 503);
    }
  }
}

export const weatherService = new WeatherService();
