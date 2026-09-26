import { LayersControl, TileLayer } from "react-leaflet";

const GOOGLE_ROAD_URL =
  "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";
const GOOGLE_SATELLITE_URL =
  "https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}";
const OPEN_STREET_MAP_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const GOOGLE_SUBDOMAINS = ["mt0", "mt1", "mt2", "mt3"];

/**
 * Base layers shared by every Leaflet map in EcoAlert.
 * Google Road is the default and does not use the Google Maps JavaScript API.
 */
export function EcoAlertBaseMap() {
  return (
    <LayersControl position="bottomright">
      <LayersControl.BaseLayer checked name="Google Map">
        <TileLayer
          attribution="&copy; Google Maps"
          maxZoom={20}
          subdomains={GOOGLE_SUBDOMAINS}
          url={GOOGLE_ROAD_URL}
        />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer name="Satellite">
        <TileLayer
          attribution="&copy; Google Maps"
          maxZoom={20}
          subdomains={GOOGLE_SUBDOMAINS}
          url={GOOGLE_SATELLITE_URL}
        />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer name="OpenStreetMap">
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          maxZoom={19}
          url={OPEN_STREET_MAP_URL}
        />
      </LayersControl.BaseLayer>
    </LayersControl>
  );
}
