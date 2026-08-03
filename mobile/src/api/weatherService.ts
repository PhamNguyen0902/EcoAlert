import { api } from "./client";
import type { ApiResponse, CurrentWeather, WeatherDetails } from "../types";

export const weatherService = {
  getCurrent: async (latitude: number, longitude: number): Promise<CurrentWeather> => {
    const response = await api.get<ApiResponse<CurrentWeather>>("/v1/gis/weather", {
      params: { lat: latitude, lng: longitude },
    });
    return response.data.data;
  },
  getDetails: async (latitude: number, longitude: number): Promise<WeatherDetails> => {
    const response = await api.get<ApiResponse<WeatherDetails>>("/v1/gis/weather/details", {
      params: { lat: latitude, lng: longitude },
    });
    return response.data.data;
  },
};
