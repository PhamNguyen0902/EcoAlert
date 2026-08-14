import { api } from "./client";
import type { IncidentDensity, IncidentDensityDrilldown } from "../types";

type GisFilters = Record<string, string>;

const buildQuery = (values: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return query.toString();
};

/** Reuses the Admin-protected GIS API used by the web incident-density page. */
export const gisService = {
  async getIncidentDensity(filters: GisFilters = {}): Promise<IncidentDensity> {
    const query = buildQuery(filters);
    const response = await api.get<{ data: IncidentDensity }>(
      `/v1/gis/incidents/heatmap${query ? `?${query}` : ""}`,
    );
    return response.data.data;
  },

  async getIncidentDensityDrilldown(
    latitude: number,
    longitude: number,
    radius = 750,
    filters: GisFilters = {},
  ): Promise<IncidentDensityDrilldown> {
    const query = buildQuery({
      lat: latitude,
      lng: longitude,
      radius,
      ...filters,
    });
    const response = await api.get<{ data: IncidentDensityDrilldown }>(
      `/v1/gis/incidents/nearby?${query}`,
    );
    return response.data.data;
  },
};
