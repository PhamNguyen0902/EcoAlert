import type { HeatLatLngTuple } from 'leaflet';
import type { HeatmapPoint, HeatmapSummary } from '@/types';
import {
  SEVERITY_ORDER,
  isValidMapCoordinate,
  normalizeMapCategory,
  normalizeSeverity,
} from './gis-heatmap';

export type AdminDensityMapMode = 'heatmap' | 'incidents' | 'combined';

export const densityLayerVisibility = (mode: AdminDensityMapMode) => ({
  heatmap: mode !== 'incidents',
  incidents: mode !== 'heatmap',
});

export const getDensityPointLatLng = (
  point: Pick<HeatmapPoint, 'lat' | 'lng'>,
): [number, number] | null =>
  isValidMapCoordinate(point.lat, point.lng) ? [point.lat, point.lng] : null;

export const toDensityHeatPoint = (
  point: Pick<HeatmapPoint, 'lat' | 'lng' | 'weight'>,
): HeatLatLngTuple | null => {
  const position = getDensityPointLatLng(point);
  if (!position) return null;
  const weight = Number.isFinite(point.weight) && point.weight > 0 ? point.weight : 1;
  return [position[0], position[1], weight];
};

export const incidentReportCode = (incidentId: string) =>
  `#${incidentId.slice(-8).toUpperCase()}`;

export const incidentDetailHref = (incidentId: string) =>
  `/admin/reports/${incidentId}`;

type DensitySummaryGroups = {
  byCategory: Array<[string, number]>;
  bySeverity: Array<[string, number]>;
};

const mergeNormalizedCounts = (
  counts: Record<string, number> | undefined,
  normalize: (key: string) => string,
) => Object.entries(counts ?? {}).reduce<Record<string, number>>((result, [key, count]) => {
  if (!Number.isFinite(count) || count <= 0) return result;
  const normalized = normalize(key);
  result[normalized] = (result[normalized] ?? 0) + count;
  return result;
}, {});

export const normalizeDensitySummary = (
  summary?: Pick<HeatmapSummary, 'byCategory' | 'bySeverity'>,
): DensitySummaryGroups => {
  const severityCounts = mergeNormalizedCounts(
    summary?.bySeverity,
    (severity) => normalizeSeverity(severity) ?? 'unknown',
  );
  const categoryCounts = mergeNormalizedCounts(
    summary?.byCategory,
    (category) => normalizeMapCategory(category) || 'unclassified',
  );
  const severityPosition = new Map<string, number>(
    SEVERITY_ORDER.map((severity, index) => [severity, index]),
  );

  return {
    bySeverity: Object.entries(severityCounts).sort(([left], [right]) =>
      (severityPosition.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (severityPosition.get(right) ?? Number.MAX_SAFE_INTEGER),
    ),
    byCategory: Object.entries(categoryCounts).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  };
};
