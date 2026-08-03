import { useQuery } from "@tanstack/react-query";
import { weatherService } from "../api/weatherService";

const WEATHER_STALE_TIME_MS = 10 * 60 * 1000;
const WEATHER_CACHE_TIME_MS = 30 * 60 * 1000;
const WEATHER_DETAILS_STALE_TIME_MS = 20 * 60 * 1000;
const WEATHER_DETAILS_CACHE_TIME_MS = 60 * 60 * 1000;

export const roundWeatherCoordinate = (value: number): number =>
  Math.round(value * 1000) / 1000;

export const useWeather = (
  latitude: number,
  longitude: number,
  enabled = true,
) =>
  useQuery({
    queryKey: [
      "weather",
      roundWeatherCoordinate(latitude),
      roundWeatherCoordinate(longitude),
    ],
    queryFn: () =>
      weatherService.getCurrent(
        roundWeatherCoordinate(latitude),
        roundWeatherCoordinate(longitude),
      ),
    enabled,
    staleTime: WEATHER_STALE_TIME_MS,
    gcTime: WEATHER_CACHE_TIME_MS,
    retry: 1,
    refetchInterval: false,
    refetchOnMount: false,
  });

export const useWeatherDetails = (
  latitude: number,
  longitude: number,
  enabled = true,
) => {
  const roundedLatitude = roundWeatherCoordinate(latitude);
  const roundedLongitude = roundWeatherCoordinate(longitude);

  return useQuery({
    queryKey: ["weather-details", roundedLatitude, roundedLongitude],
    queryFn: () => weatherService.getDetails(roundedLatitude, roundedLongitude),
    enabled,
    staleTime: WEATHER_DETAILS_STALE_TIME_MS,
    gcTime: WEATHER_DETAILS_CACHE_TIME_MS,
    retry: 1,
    refetchInterval: false,
    refetchOnMount: false,
  });
};
