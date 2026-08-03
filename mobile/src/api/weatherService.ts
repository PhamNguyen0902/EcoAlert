import { api } from "./client";
import type { ApiResponse, CurrentWeather } from "../types";

export const weatherService = {
  getCurrent: async (latitude: number, longitude: number): Promise<CurrentWeather> => {
    const response = await api.get<ApiResponse<CurrentWeather>>("/v1/gis/weather", {
      params: { lat: latitude, lng: longitude },
    });
    return response.data.data;
  },
};
