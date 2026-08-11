export interface WeatherCoordinates {
  lat: number;
  lng: number;
}

export const roundWeatherCoordinate = (value: number): number =>
  Math.round(value * 1000) / 1000;

export const isValidWeatherCoordinate = (
  lat: unknown,
  lng: unknown,
): lat is number =>
  typeof lat === 'number' &&
  Number.isFinite(lat) &&
  lat >= -90 &&
  lat <= 90 &&
  typeof lng === 'number' &&
  Number.isFinite(lng) &&
  lng >= -180 &&
  lng <= 180;

export const toWeatherCoordinates = (
  lat: unknown,
  lng: unknown,
): WeatherCoordinates | null => {
  if (!isValidWeatherCoordinate(lat, lng)) return null;
  return {
    lat: roundWeatherCoordinate(lat),
    lng: roundWeatherCoordinate(lng as number),
  };
};

export const parseWeatherCoordinates = (
  searchParams: URLSearchParams,
): WeatherCoordinates | null => {
  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));
  return toWeatherCoordinates(lat, lng);
};

export const weatherDetailsSearch = ({ lat, lng }: WeatherCoordinates): string =>
  '?lat=' + encodeURIComponent(String(roundWeatherCoordinate(lat))) +
  '&lng=' + encodeURIComponent(String(roundWeatherCoordinate(lng)));

export const weatherAqiLabelKey = (aqi: number): string =>
  ['weather.aqi_unknown', 'weather.aqi_good', 'weather.aqi_fair', 'weather.aqi_moderate', 'weather.aqi_poor', 'weather.aqi_very_poor'][aqi] ??
  'weather.aqi_unknown';

export const providerLocalDateKey = (
  timestamp: string | number | Date,
  timezoneOffsetSeconds: number,
): string | null => {
  const milliseconds = new Date(timestamp).getTime();
  if (!Number.isFinite(milliseconds)) return null;
  return new Date(milliseconds + timezoneOffsetSeconds * 1000)
    .toISOString()
    .slice(0, 10);
};

export const formatProviderLocalTime = (
  timestamp: string | number | Date,
  timezoneOffsetSeconds: number,
  locale: string,
): string => {
  const milliseconds = new Date(timestamp).getTime();
  if (!Number.isFinite(milliseconds)) return '—';
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(new Date(milliseconds + timezoneOffsetSeconds * 1000));
};

export const formatProviderLocalDay = (
  date: string,
  locale: string,
): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return '—';
  const [, year, month, day] = match;
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))));
};
