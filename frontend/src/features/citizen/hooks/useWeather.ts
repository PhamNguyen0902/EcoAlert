import { useQuery } from '@tanstack/react-query';
import { getFullWeather } from '../services/weatherService';
import { WeatherData } from '@/types';

export const useWeather = (lat: number | null, lng: number | null) => {
  return useQuery<WeatherData, Error>({
    queryKey: ['weather', lat, lng],
    queryFn: () => {
      if (lat === null || lng === null) {
        throw new Error('Coordinates are required');
      }
      return getFullWeather(lat, lng);
    },
    enabled: !!lat && !!lng,
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    staleTime: 3 * 60 * 1000, // 3 minutes
    retry: 2,
  });
};
