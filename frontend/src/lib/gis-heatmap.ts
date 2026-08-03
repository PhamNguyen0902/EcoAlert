import type { HeatLatLngTuple } from 'leaflet';
import type { Alert, AlertCategory, AlertStatus, Severity } from '@/types';

export type MapVisualizationMode = 'markers' | 'heatmap';
export type MapSeverityFilter = Severity | 'all';
export type MapCategoryFilter = AlertCategory | 'all';
export type MapStatusFilter = 'all' | 'active' | 'resolved' | 'closed';

export interface MapIncidentFilters {
  search: string;
  severity: MapSeverityFilter;
  category: MapCategoryFilter;
  status: MapStatusFilter;
}

export interface SeverityCounts extends Record<Severity, number> {
  all: number;
}

const ACTIVE_STATUSES: ReadonlySet<AlertStatus> = new Set([
  'pending',
  'ai_analyzing',
  'verified',
  'assigned',
  'in_progress',
]);

export const SEVERITY_ORDER: readonly Severity[] = [
  'critical',
  'high',
  'medium',
  'low',
];

export const SEVERITY_WEIGHTS: Readonly<Record<Severity, number>> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 5,
};

export const SEVERITY_COLORS: Readonly<Record<Severity, string>> = {
  low: '#22C55E',
  medium: '#EAB308',
  high: '#F97316',
  critical: '#EF4444',
};

export const HEATMAP_OPTIONS = {
  radius: 30,
  blur: 22,
  maxZoom: 17,
  minOpacity: 0.25,
  max: 1,
  gradient: {
    0.2: '#22C55E',
    0.4: '#EAB308',
    0.65: '#F97316',
    1: '#DC2626',
  },
} as const;

export const normalizeSeverity = (value: unknown): Severity | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'normal') return 'medium';
  return SEVERITY_ORDER.includes(normalized as Severity)
    ? (normalized as Severity)
    : null;
};

export const getSeverityWeight = (severity: unknown): number => {
  const normalized = normalizeSeverity(severity);
  return normalized ? SEVERITY_WEIGHTS[normalized] : SEVERITY_WEIGHTS.low;
};

export const getNormalizedSeverityWeight = (severity: unknown): number =>
  getSeverityWeight(severity) / SEVERITY_WEIGHTS.critical;

export const normalizeMapCategory = (value: unknown): string =>
  typeof value === 'string'
    ? value.trim().toLocaleLowerCase().replace(/[\s_-]+/g, '_')
    : '';

export const isValidMapCoordinate = (
  latitude: unknown,
  longitude: unknown,
): boolean =>
  typeof latitude === 'number' &&
  Number.isFinite(latitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  typeof longitude === 'number' &&
  Number.isFinite(longitude) &&
  longitude >= -180 &&
  longitude <= 180;

export const getIncidentLatLng = (alert: Alert): [number, number] | null => {
  const longitude = alert.location?.coordinates?.[0];
  const latitude = alert.location?.coordinates?.[1];
  return isValidMapCoordinate(latitude, longitude)
    ? [latitude as number, longitude as number]
    : null;
};

export const buildHeatPoints = (alerts: readonly Alert[]): HeatLatLngTuple[] =>
  alerts.flatMap((alert) => {
    const coordinates = getIncidentLatLng(alert);
    return coordinates
      ? [[coordinates[0], coordinates[1], getNormalizedSeverityWeight(alert.severity)]]
      : [];
  });

const matchesStatusFilter = (status: AlertStatus, filter: MapStatusFilter): boolean => {
  if (filter === 'all') return true;
  if (filter === 'active') return ACTIVE_STATUSES.has(status);
  return status === filter;
};

export const filterIncidentsForMap = (
  alerts: readonly Alert[],
  filters: MapIncidentFilters,
): Alert[] => {
  const search = filters.search.trim().toLocaleLowerCase();

  return alerts.filter((alert) => {
    const severity = normalizeSeverity(alert.severity);
    const matchesSearch =
      !search ||
      alert.title.toLocaleLowerCase().includes(search) ||
      alert.address?.toLocaleLowerCase().includes(search);
    const matchesSeverity = filters.severity === 'all' || severity === filters.severity;
    const matchesCategory =
      filters.category === 'all' ||
      normalizeMapCategory(alert.category) === normalizeMapCategory(filters.category);
    const matchesStatus = matchesStatusFilter(alert.status, filters.status);

    return matchesSearch && matchesSeverity && matchesCategory && matchesStatus;
  });
};

export const countIncidentsBySeverity = (alerts: readonly Alert[]): SeverityCounts =>
  alerts.reduce<SeverityCounts>(
    (counts, alert) => {
      const severity = normalizeSeverity(alert.severity);
      counts.all += 1;
      if (severity) counts[severity] += 1;
      return counts;
    },
    { all: 0, critical: 0, high: 0, medium: 0, low: 0 },
  );

export const formatMapLabel = (value: string): string =>
  value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
