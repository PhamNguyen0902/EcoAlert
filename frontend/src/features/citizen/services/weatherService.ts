import { api } from "@/services/api";
import type { ApiResponse, WeatherData, WeatherDetails } from "@/types";

export const weatherService = {
  getCurrent: async (lat: number, lng: number): Promise<WeatherData> => {
    const response = await api.get<ApiResponse<WeatherData>>("/v1/gis/weather", {
      params: { lat, lng },
    });

    return response.data.data;
  },
  getDetails: async (lat: number, lng: number): Promise<WeatherDetails> => {
    const response = await api.get<ApiResponse<WeatherDetails>>(
      "/v1/gis/weather/details",
      { params: { lat, lng } },
    );

    return response.data.data;
  },
};

export const getFullWeather = weatherService.getCurrent;
