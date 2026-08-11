import { api } from "@/services/api";
import type { ApiResponse, WeatherData } from "@/types";

export const getFullWeather = async (
  lat: number,
  lng: number,
): Promise<WeatherData> => {
  const response = await api.get<ApiResponse<WeatherData>>("/v1/gis/weather", {
    params: { lat, lng },
  });

  return response.data.data;
};
