import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import maplibregl from "maplibre-gl";

// 👇 Gán global để plugin UMD tìm thấy
(window as any).L = L;
(window as any).maplibregl = maplibregl;

import "@maplibre/maplibre-gl-leaflet";
import "maplibre-gl/dist/maplibre-gl.css";

interface GoongMapLayerProps {
  apiKey?: string;
}

export const GoongMapLayer = ({ apiKey }: GoongMapLayerProps) => {
  const map = useMap();
  const key = apiKey || import.meta.env.VITE_GOONG_MAPTILES_KEY;

  useEffect(() => {
    if (!key) return;

    const glLayer = (L as any).maplibreGL({
      style: `https://tiles.goong.io/assets/goong_map_web.json?api_key=${key}`,
      attribution: '&copy; Goong',
    });

    glLayer.addTo(map);

    (window as any).__glLayer = glLayer;
    console.log('✅ Đã add, glLayer._glMap =', (glLayer as any)._glMap);

    return () => {
      map.removeLayer(glLayer);
    };
  }, [map, key]);

  return null;
};