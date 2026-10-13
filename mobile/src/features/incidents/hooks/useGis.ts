import { useQuery } from "@tanstack/react-query";
import { gisService } from "../api/gisService";

type GisFilters = Record<string, string>;
type MapCoordinate = { latitude: number; longitude: number } | null;

const EMPTY_FILTERS: GisFilters = {};

export const useIncidentDensity = (filters: GisFilters = EMPTY_FILTERS) =>
  useQuery({
    queryKey: ["admin-incident-density", filters],
    queryFn: () => gisService.getIncidentDensity(filters),
    staleTime: 60_000,
  });

export const useIncidentDensityDrilldown = (
  center: MapCoordinate,
  filters: GisFilters = EMPTY_FILTERS,
) =>
  useQuery({
    queryKey: [
      "admin-incident-density-drilldown",
      center?.latitude,
      center?.longitude,
      filters,
    ],
    queryFn: () =>
      gisService.getIncidentDensityDrilldown(
        center!.latitude,
        center!.longitude,
        750,
        filters,
      ),
    enabled: Boolean(center),
    staleTime: 30_000,
  });
