import { useEffect, useRef } from "react";
import { MapContainer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";
import { EcoAlertBaseMap } from "@/components/location/EcoAlertBaseMap";
import type { AreaGeometry } from "@/services/serviceAreas";

function Drawing({
  value,
  onChange,
}: {
  value: AreaGeometry | null;
  onChange: (v: AreaGeometry | null) => void;
}) {
  const map = useMap();
  const group = useRef<L.FeatureGroup>();
  const emitted = useRef<AreaGeometry | null>();
  const change = useRef(onChange);
  change.current = onChange;
  useEffect(() => {
    const layers = new L.FeatureGroup().addTo(map);
    group.current = layers;
    const control = new L.Control.Draw({
      position: "topright",
      draw: {
        polygon: {
          allowIntersection: false,
          shapeOptions: { color: "#10B981" },
        },
        polyline: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false,
      },
      edit: { featureGroup: layers },
    });
    map.addControl(control);
    const sync = () => {
      const polygons: number[][][][] = [];
      layers.eachLayer((layer) => {
        if (layer instanceof L.Polygon) {
          const geometry = layer.toGeoJSON().geometry;
          if (geometry.type === "Polygon") polygons.push(geometry.coordinates);
          else if (geometry.type === "MultiPolygon")
            polygons.push(...geometry.coordinates);
        }
      });
      const result: AreaGeometry | null =
        polygons.length === 0
          ? null
          : polygons.length === 1
            ? { type: "Polygon", coordinates: polygons[0] }
            : { type: "MultiPolygon", coordinates: polygons };
      emitted.current = result;
      change.current(result);
    };
    const created = (event: L.LeafletEvent) => {
      layers.addLayer((event as L.DrawEvents.Created).layer);
      sync();
    };
    map.on(L.Draw.Event.CREATED, created);
    map.on(L.Draw.Event.EDITED, sync);
    map.on(L.Draw.Event.DELETED, sync);
    return () => {
      map.off(L.Draw.Event.CREATED, created);
      map.off(L.Draw.Event.EDITED, sync);
      map.off(L.Draw.Event.DELETED, sync);
      map.removeControl(control);
      map.removeLayer(layers);
      group.current = undefined;
    };
  }, [map]);
  useEffect(() => {
    if (!group.current || value === emitted.current) return;
    group.current.clearLayers();
    if (!value) return;
    const polygons =
      value.type === "Polygon" ? [value.coordinates] : value.coordinates;
    polygons.forEach((coordinates) => {
      const polygon: import("geojson").Polygon = {
        type: "Polygon",
        coordinates,
      };
      L.geoJSON(polygon, { style: { color: "#10B981", weight: 2 } }).eachLayer(
        (layer) => group.current!.addLayer(layer),
      );
    });
    if (group.current.getBounds().isValid())
      map.fitBounds(group.current.getBounds(), {
        padding: [24, 24],
        maxZoom: 16,
      });
  }, [map, value]);
  return null;
}
export function AreaGeometryEditor(props: {
  value: AreaGeometry | null;
  onChange: (v: AreaGeometry | null) => void;
}) {
  return (
    <div className="relative isolate z-0 h-[400px] overflow-hidden rounded-xl border border-slate-700">
      <MapContainer center={[10.82, 106.7]} zoom={11} className="h-full w-full">
        <EcoAlertBaseMap />
        <Drawing {...props} />
      </MapContainer>
    </div>
  );
}
