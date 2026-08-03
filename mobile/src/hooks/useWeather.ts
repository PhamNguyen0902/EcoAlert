import { useQuery } from "@tanstack/react-query";
import { weatherService } from "../api/weatherService";

const WEATHER_STALE_TIME_MS = 10 * 60 * 1000;
const WEATHER_CACHE_TIME_MS = 30 * 60 * 1000;

export const useWeather = (
  latitude: number,
  longitude: number,
  enabled = true,
) =>
  useQuery({
    queryKey: ["weather", latitude, longitude],
    queryFn: () => weatherService.getCurrent(latitude, longitude),
    enabled,
    staleTime: WEATHER_STALE_TIME_MS,
    gcTime: WEATHER_CACHE_TIME_MS,
    retry: 1,
    refetchInterval: false,
    refetchOnMount: false,
  });
