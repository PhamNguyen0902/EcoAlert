import type { WeatherDetails } from "../types";

export type WeatherGuidanceCode =
  | "veryPoorAir"
  | "sensitiveAir"
  | "heavyRain"
  | "rain"
  | "heat"
  | "wind"
  | "pleasant";

export type WeatherAlertCode = "air" | "storm" | "rain" | "heat" | "wind";

export const formatWeatherTime = (
  timestamp: string,
  timezoneOffsetSeconds: number,
  locale: string,
): string => {
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) return "—";
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(time + timezoneOffsetSeconds * 1000));
};

export const formatWeatherDay = (date: string, locale: string): string => {
  const time = Date.parse(`${date}T12:00:00.000Z`);
  if (!Number.isFinite(time)) return date;
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(time));
};

export const formatWeatherDate = (
  timestamp: number,
  timezoneOffsetSeconds: number,
  locale: string,
): string =>
  new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(timestamp + timezoneOffsetSeconds * 1000));

export const getProviderLocalDate = (
  timestamp: number,
  timezoneOffsetSeconds: number,
): string =>
  new Date(timestamp + timezoneOffsetSeconds * 1000)
    .toISOString()
    .slice(0, 10);

export const getWeatherGuidance = (details: WeatherDetails): WeatherGuidanceCode[] => {
  const guidance: WeatherGuidanceCode[] = [];
  const nextPeriods = details.hourly.slice(0, 4);
  const maxRainChance = Math.max(
    0,
    ...nextPeriods.map((period) => period.precipitationProbability),
  );
  const hasStorm = nextPeriods.some((period) =>
    period.condition.toLowerCase().includes("thunderstorm"),
  );

  if ((details.airQuality?.aqi ?? 0) >= 4) guidance.push("veryPoorAir");
  else if ((details.airQuality?.aqi ?? 0) === 3) guidance.push("sensitiveAir");

  if (hasStorm || maxRainChance >= 80) guidance.push("heavyRain");
  else if (maxRainChance >= 50) guidance.push("rain");

  if (details.current.temperature >= 35) guidance.push("heat");
  if (details.current.windSpeed >= 40) guidance.push("wind");
  if (guidance.length === 0) guidance.push("pleasant");

  return guidance;
};

export const getWeatherAlert = (details: WeatherDetails): WeatherAlertCode | null => {
  if ((details.airQuality?.aqi ?? 0) >= 4) return "air";
  if (
    details.hourly.slice(0, 4).some((period) =>
      period.condition.toLowerCase().includes("thunderstorm"),
    )
  ) return "storm";
  if (
    Math.max(0, ...details.hourly.slice(0, 4).map((period) => period.precipitationProbability)) >= 80
  ) return "rain";
  if (details.current.temperature >= 38) return "heat";
  if (details.current.windSpeed >= 50) return "wind";
  return null;
};
