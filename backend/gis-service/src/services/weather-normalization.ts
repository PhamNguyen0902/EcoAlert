const OPENWEATHER_ICON_URL = 'https://openweathermap.org/img/wn';

export interface ForecastPeriod {
  timestamp: string;
  temperature: number;
  feelsLike: number;
  temperatureMin: number;
  temperatureMax: number;
  condition: string;
  description: string;
  icon: string;
  precipitationProbability: number;
}

export interface DailyForecast {
  date: string;
  minTemperature: number;
  maxTemperature: number;
  condition: string;
  description: string;
  icon: string;
  precipitationProbability: number;
}

interface ForecastEntryCandidate {
  dt?: unknown;
  main?: {
    temp?: unknown;
    feels_like?: unknown;
    temp_min?: unknown;
    temp_max?: unknown;
  };
  weather?: Array<{
    main?: unknown;
    description?: unknown;
    icon?: unknown;
  }>;
  pop?: unknown;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const iconUrl = (code: string): string =>
  code ? `${OPENWEATHER_ICON_URL}/${code}@2x.png` : '';

const precipitationPercent = (value: unknown): number => {
  if (!isFiniteNumber(value) || value < 0 || value > 1) return 0;
  return Math.round(value * 100);
};

export const providerLocalDateKey = (
  timestampSeconds: number,
  timezoneOffsetSeconds: number,
): string =>
  new Date((timestampSeconds + timezoneOffsetSeconds) * 1000)
    .toISOString()
    .slice(0, 10);

export const normalizeForecastEntries = (value: unknown): ForecastPeriod[] => {
  if (!Array.isArray(value)) return [];

  return value
    .flatMap((rawValue): ForecastPeriod[] => {
      if (!rawValue || typeof rawValue !== 'object') return [];
      const entry = rawValue as ForecastEntryCandidate;
      const weather = entry.weather?.[0];

      if (
        !isFiniteNumber(entry.dt) ||
        !isFiniteNumber(entry.main?.temp) ||
        !isFiniteNumber(entry.main.feels_like) ||
        !isFiniteNumber(entry.main.temp_min) ||
        !isFiniteNumber(entry.main.temp_max) ||
        typeof weather?.main !== 'string' ||
        typeof weather.description !== 'string' ||
        typeof weather.icon !== 'string'
      ) {
        return [];
      }

      return [
        {
          timestamp: new Date(entry.dt * 1000).toISOString(),
          temperature: entry.main.temp,
          feelsLike: entry.main.feels_like,
          temperatureMin: entry.main.temp_min,
          temperatureMax: entry.main.temp_max,
          condition: weather.main,
          description: weather.description,
          icon: iconUrl(weather.icon),
          precipitationProbability: precipitationPercent(entry.pop),
        },
      ];
    })
    .sort(
      (left, right) =>
        Date.parse(left.timestamp) - Date.parse(right.timestamp),
    );
};

export const aggregateDailyForecast = (
  periods: ForecastPeriod[],
  timezoneOffsetSeconds: number,
  limit = 5,
): DailyForecast[] => {
  const groups = new Map<string, ForecastPeriod[]>();

  periods.forEach((period) => {
    const timestampSeconds = Date.parse(period.timestamp) / 1000;
    if (!Number.isFinite(timestampSeconds)) return;
    const date = providerLocalDateKey(timestampSeconds, timezoneOffsetSeconds);
    const group = groups.get(date) ?? [];
    group.push(period);
    groups.set(date, group);
  });

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, limit)
    .map(([date, dayPeriods]) => {
      const representative = dayPeriods.reduce((closest, candidate) => {
        const candidateHour = new Date(
          Date.parse(candidate.timestamp) + timezoneOffsetSeconds * 1000,
        ).getUTCHours();
        const closestHour = new Date(
          Date.parse(closest.timestamp) + timezoneOffsetSeconds * 1000,
        ).getUTCHours();
        return Math.abs(candidateHour - 12) < Math.abs(closestHour - 12)
          ? candidate
          : closest;
      });

      return {
        date,
        minTemperature: Math.min(
          ...dayPeriods.map((period) => period.temperatureMin),
        ),
        maxTemperature: Math.max(
          ...dayPeriods.map((period) => period.temperatureMax),
        ),
        condition: representative.condition,
        description: representative.description,
        icon: representative.icon,
        precipitationProbability: Math.max(
          ...dayPeriods.map((period) => period.precipitationProbability),
        ),
      };
    });
};
