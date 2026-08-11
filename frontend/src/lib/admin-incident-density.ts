import type { HeatLatLngTuple } from 'leaflet';
import type { HeatmapPoint } from '@/types';
import { isValidMapCoordinate } from './gis-heatmap';

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
