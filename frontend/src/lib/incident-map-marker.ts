import L from 'leaflet';
import { SEVERITY_COLORS, normalizeSeverity } from './gis-heatmap';

export const createIncidentMarkerIcon = (
  severity: unknown,
  options: { emphasized?: boolean; size?: number } = {},
) => {
  const normalizedSeverity = normalizeSeverity(severity) ?? 'low';
  const color = SEVERITY_COLORS[normalizedSeverity];
  const size = options.size ?? 22;
  const emphasizedClass = options.emphasized
    ? ' ecoalert-incident-marker--emphasized'
    : '';

  return L.divIcon({
    className: `ecoalert-incident-marker${emphasizedClass}`,
    html: `<span class="ecoalert-incident-marker__dot" style="background-color: ${color}; height: ${size}px; width: ${size}px;"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -12],
  });
};
