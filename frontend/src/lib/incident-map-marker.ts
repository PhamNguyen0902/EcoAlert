import L from 'leaflet';
import { SEVERITY_COLORS, normalizeSeverity } from './map-filters';

export const INCIDENT_MARKER_DEFAULT_SIZE = 24;

export const createIncidentMarkerIcon = (
  severity: unknown,
  options: { emphasized?: boolean; size?: number } = {},
) => {
  const normalizedSeverity = normalizeSeverity(severity) ?? 'low';
  const color = SEVERITY_COLORS[normalizedSeverity];
  const size = options.size ?? INCIDENT_MARKER_DEFAULT_SIZE;
  const emphasizedClass = options.emphasized
    ? ' ecoalert-incident-marker--emphasized'
    : '';

  return L.divIcon({
    className: `ecoalert-incident-marker${emphasizedClass}`,
    html: `<span class="ecoalert-incident-marker__dot" style="background-color: ${color}; height: ${size}px; width: ${size}px;"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 2)],
  });
};

type IncidentCluster = {
  getChildCount: () => number;
};

const incidentClusterPresentation = (count: number) => {
  if (count >= 50) return { className: 'xlarge', size: 44 };
  if (count >= 25) return { className: 'large', size: 40 };
  if (count >= 10) return { className: 'medium', size: 36 };
  return { className: 'small', size: 32 };
};

export const createIncidentClusterIcon = (cluster: IncidentCluster) => {
  const count = cluster.getChildCount();
  const { className, size } = incidentClusterPresentation(count);

  return L.divIcon({
    className: `ecoalert-incident-cluster ecoalert-incident-cluster--${className}`,
    html: `<span class="ecoalert-incident-cluster__inner"><span class="ecoalert-incident-cluster__count">${count}</span></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};
