import { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet.heat';
import { useMap } from 'react-leaflet';
import { HEATMAP_OPTIONS } from '@/lib/gis-heatmap';

interface HeatmapLayerProps {
  points: readonly L.HeatLatLngTuple[];
  options?: L.HeatMapOptions;
}

export function HeatmapLayer({
  points,
  options = HEATMAP_OPTIONS,
}: HeatmapLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    const layer = L.heatLayer([...points], options).addTo(map);

    return () => {
      const pendingFrame = (layer as L.HeatLayer & { _frame?: number })._frame;
      if (pendingFrame !== undefined && pendingFrame !== null) {
        L.Util.cancelAnimFrame(pendingFrame);
      }
      if (map.hasLayer(layer)) map.removeLayer(layer);
    };
  }, [map, options, points]);

  return null;
}
