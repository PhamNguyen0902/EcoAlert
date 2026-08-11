import { useQuery } from '@tanstack/react-query';
import { roundWeatherCoordinate } from '@/lib/weather-details';
import { weatherService } from '../services/weatherService';
import type { WeatherData, WeatherDetails } from '@/types';

export const useWeather = (lat: number | null, lng: number | null) => {
  const enabled = lat !== null && lng !== null;
  const roundedLat = enabled ? roundWeatherCoordinate(lat) : null;
  const roundedLng = enabled ? roundWeatherCoordinate(lng) : null;

  return useQuery<WeatherData, Error>({
    queryKey: ['weather', roundedLat, roundedLng],
    queryFn: () => {
      if (roundedLat === null || roundedLng === null) {
        throw new Error('Coordinates are required');
      }
      return weatherService.getCurrent(roundedLat, roundedLng);
    },
    enabled,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    refetchInterval: false,
    refetchOnMount: false,
  });
};

export const useWeatherDetails = (lat: number | null, lng: number | null) => {
  const enabled = lat !== null && lng !== null;
  const roundedLat = enabled ? roundWeatherCoordinate(lat) : null;
  const roundedLng = enabled ? roundWeatherCoordinate(lng) : null;

  return useQuery<WeatherDetails, Error>({
    queryKey: ['weather-details', roundedLat, roundedLng],
    queryFn: () => {
      if (roundedLat === null || roundedLng === null) {
        throw new Error('Coordinates are required');
      }
      return weatherService.getDetails(roundedLat, roundedLng);
    },
    enabled,
    staleTime: 20 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    refetchInterval: false,
    refetchOnMount: false,
  });
};
