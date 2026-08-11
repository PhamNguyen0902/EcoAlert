import { api } from "./client";
import type {
  ApiResponse,
  IncidentDensityDrilldown,
  IncidentDensityResult,
} from "../types";

/**
 * Mobile reads the same GIS aggregation endpoints as the web app.  The service
 * deliberately contains no density calculation or generated coordinates.
 */
export const gisService = {
  getIncidentHeatmap: async (
    filters: Record<string, string> = {},
  ): Promise<IncidentDensityResult> => {
    const response = await api.get<ApiResponse<IncidentDensityResult>>(
      "/v1/gis/incidents/heatmap",
      { params: filters },
    );
    return response.data.data;
  },

  getIncidentDrilldown: async (
    latitude: number,
    longitude: number,
    radius = 750,
    filters: Record<string, string> = {},
  ): Promise<IncidentDensityDrilldown> => {
    const response = await api.get<ApiResponse<IncidentDensityDrilldown>>(
      "/v1/gis/incidents/nearby",
      { params: { lat: latitude, lng: longitude, radius, ...filters } },
    );
    return response.data.data;
  },
};
