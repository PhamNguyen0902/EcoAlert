import React, { useMemo, useState, type ReactNode } from "react";
import { MapContainer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { Alert, Severity } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createIncidentMarkerIcon } from "@/lib/incident-map-marker";
import { SEVERITY_COLORS } from "@/lib/map-filters";
import { useGeolocation } from "@/features/citizen/hooks/useGeolocation";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getIncidentCategoryLabel,
  getIncidentSeverityLabel,
  getIncidentStatusLabel,
} from "@/lib/incident-presentation";
import { EcoAlertBaseMap } from "@/components/location/EcoAlertBaseMap";
// xử lý lỗi không tải được icon mặc định của leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface IncidentMapProps {
  alerts: Alert[];
  selectedCategory: string | null;
  onSelectCategory?: (cat: string | null) => void;
  categoryFilter?: ReactNode;
}
// tạo icon ghim vị trí hiện tại của người dùng
const userLocationIcon = L.divIcon({
  className: "user-location-marker",
  html: `<div class="relative flex h-5 w-5">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-5 w-5 bg-blue-500 border-2 border-white"></span>
        </div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const DEFAULT_CENTER: [number, number] = [10.8231, 106.6297]; // vị trí mặc định

// bản đồ sự cố: hiển thị vị trí sự cố theo nhóm cụm (cluster), vị trí người dùng, bộ lọc mức độ nghiêm trọng và bảng chú thích
export const IncidentMap: React.FC<IncidentMapProps> = ({
  alerts,
  selectedCategory,
  categoryFilter,
}) => {
  const { language } = useLanguage();
  const { latitude, longitude } = useGeolocation();
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");

  const center: [number, number] =
    latitude && longitude ? [latitude, longitude] : DEFAULT_CENTER;

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const matchCategory = selectedCategory
        ? alert.category === selectedCategory
        : true;
      const matchSeverity =
        severityFilter === "all" ? true : alert.severity === severityFilter;
      return matchCategory && matchSeverity;
    });
  }, [alerts, selectedCategory, severityFilter]);

  const severityCounts = useMemo(() => {
    const counts = {
      all: alerts.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    alerts.forEach((a) => {
      if (a.severity && counts[a.severity] !== undefined) {
        counts[a.severity]++;
      }
    });
    return counts;
  }, [alerts]);

  const severityFilterLabel = (severity: Severity | "all") =>
    severity === "all"
      ? language === "vi"
        ? "Tất cả"
        : "All"
      : getIncidentSeverityLabel(severity, language);
  const severityLegendLabel = (severity: Severity) =>
    getIncidentSeverityLabel(severity, language);

  return (
    <div className="grid items-stretch gap-6 xl:h-[600px] xl:grid-cols-[minmax(0,1fr)_380px]">
      <div
        id="map-section"
        className="relative isolate z-0 h-[360px] w-full overflow-hidden rounded-xl border border-border shadow-lg sm:h-[420px] xl:h-full"
      >
        <MapContainer center={center}  zoom={13}  maxZoom={19} minZoom={2} className="relative z-0 h-full w-full">
          <EcoAlertBaseMap />

          <MarkerClusterGroup chunkedLoading maxClusterRadius={40}>
            {filteredAlerts.map((alert) => (
              <Marker
                key={alert._id}
                position={[
                  alert.location.coordinates[1],
                  alert.location.coordinates[0],
                ]}
                icon={createIncidentMarkerIcon(alert.severity, { size: 20 })}
              >
                <Popup className="incident-popup">
                  <div className="w-64">
                    {alert.mediaUrls && alert.mediaUrls.length > 0 && (
                      <img
                        src={alert.mediaUrls[0]}
                        alt={alert.title}
                        className="mb-2 h-24 w-full rounded-t-md object-cover"
                      />
                    )}
                    <h3 className="mb-1 truncate text-lg font-bold" title={alert.title}>
                      {alert.title}
                    </h3>
                    <div className="mb-2 flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-xs">
                        {getIncidentCategoryLabel(alert.category, language)}
                      </Badge>
                      <Badge
                        style={{
                          backgroundColor: SEVERITY_COLORS[alert.severity ?? "low"],
                          color: "white",
                        }}
                        className="text-xs"
                      >
                        {severityFilterLabel(alert.severity ?? "low")}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {getIncidentStatusLabel(alert.status, language)}
                      </Badge>
                    </div>
                    <p className="mb-3 text-xs text-muted-foreground">
                      {format(new Date(alert.createdAt), "dd/MM/yyyy")}
                    </p>
                    <Button asChild size="sm" className="w-full">
                      <Link to={`/incidents/${alert._id}`}>Xem chi tiết</Link>
                    </Button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>

          {latitude && longitude && (
            <Marker position={[latitude, longitude]} icon={userLocationIcon}>
              <Popup>Vị trí hiện tại của bạn</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      <aside className="flex min-h-[360px] flex-col rounded-xl border border-border bg-card p-4 sm:p-5 xl:h-full xl:min-h-0">
        <section>
          {categoryFilter}
        </section>

        <div className="my-4 border-t border-border" />

        <section>
          <h3 className="text-sm font-semibold">Mức độ sự cố</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["all", "critical", "high", "medium", "low"] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={cn(
                  "flex h-8 items-center justify-between gap-1.5 rounded-md border px-2 text-left text-[11px] font-medium transition-colors",
                  severityFilter === sev
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-slate-700 bg-[#0b1727] text-slate-200 hover:border-primary/50",
                )}
              >
                <span className="truncate">{severityFilterLabel(sev)}</span>
                <Badge
                  variant={severityFilter === sev ? "secondary" : "outline"}
                  className="h-5 min-w-5 shrink-0 px-1.5 py-0 text-[10px]"
                >
                  {severityCounts[sev]}
                </Badge>
              </button>
            ))}
          </div>
        </section>

        <div className="my-4 border-t border-border" />
        <section className="mt-auto">
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
            {(Object.entries(SEVERITY_COLORS) as Array<[Severity, string]>).map(([sev, color]) => (
              <span key={sev} className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full border border-white/80" style={{ backgroundColor: color }} />
                {severityLegendLabel(sev)}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border border-white/80 bg-blue-500" />
              Vị trí của bạn
            </span>
          </div>
        </section>
      </aside>
    </div>
  );
};
