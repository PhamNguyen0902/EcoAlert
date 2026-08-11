import { useQuery } from "@tanstack/react-query";
import { gisService } from "../api/gisService";

const EMPTY_FILTERS: Record<string, string> = {};

export const useIncidentDensity = (filters: Record<string, string> = EMPTY_FILTERS) =>
  useQuery({
    queryKey: ["gis", "incident-density", filters],
    queryFn: () => gisService.getIncidentHeatmap(filters),
    staleTime: 60_000,
  });

export const useIncidentDensityDrilldown = (
  center: { latitude: number; longitude: number } | null,
  filters: Record<string, string> = EMPTY_FILTERS,
) =>
  useQuery({
    queryKey: ["gis", "incident-density-drilldown", center, filters],
    queryFn: () =>
      gisService.getIncidentDrilldown(
        center!.latitude,
        center!.longitude,
        750,
        filters,
      ),
    enabled: Boolean(center),
    staleTime: 30_000,
  });
