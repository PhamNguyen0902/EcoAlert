import React, { useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Alert, Severity } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { createIncidentMarkerIcon } from '@/lib/incident-map-marker';
import { SEVERITY_COLORS } from '@/lib/map-filters';
import { useGeolocation } from '@/features/citizen/hooks/useGeolocation';
import { useLanguage } from '@/contexts/LanguageContext';
import { getIncidentCategoryLabel, getIncidentSeverityLabel, getIncidentStatusLabel } from '@/lib/incident-presentation';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface IncidentMapProps {
  alerts: Alert[];
  selectedCategory: string | null;
  onSelectCategory?: (cat: string | null) => void;
}

const userLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: `<div class="relative flex h-5 w-5">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-5 w-5 bg-blue-500 border-2 border-white"></span>
        </div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const DEFAULT_CENTER: [number, number] = [10.8231, 106.6297];

export const IncidentMap: React.FC<IncidentMapProps> = ({
  alerts,
  selectedCategory,
}) => {
  const { language } = useLanguage();
  const { latitude, longitude } = useGeolocation();
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');

  const center: [number, number] = latitude && longitude ? [latitude, longitude] : DEFAULT_CENTER;

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const matchCategory = selectedCategory ? alert.category === selectedCategory : true;
      const matchSeverity = severityFilter === 'all' ? true : alert.severity === severityFilter;
      return matchCategory && matchSeverity;
    });
  }, [alerts, selectedCategory, severityFilter]);

  const severityCounts = useMemo(() => {
    const counts = { all: alerts.length, critical: 0, high: 0, medium: 0, low: 0 };
    alerts.forEach((a) => {
      if (a.severity && counts[a.severity] !== undefined) {
        counts[a.severity]++;
      }
    });
    return counts;
  }, [alerts]);

  const severityFilterLabel = (severity: Severity | 'all') => severity === 'all'
    ? language === 'vi' ? 'Tất cả' : 'All'
    : getIncidentSeverityLabel(severity, language);
  const severityLegendLabel = (severity: Severity) => language === 'vi'
    ? `Mức độ ${getIncidentSeverityLabel(severity, language)}`
    : `${getIncidentSeverityLabel(severity, language)} severity`;

  return (
    <div id="map-section" className="relative w-full h-[400px] md:h-[600px] rounded-xl overflow-hidden shadow-lg border border-border">
      <MapContainer center={center} zoom={13} className="w-full h-full z-0">
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        <MarkerClusterGroup chunkedLoading maxClusterRadius={40}>
          {filteredAlerts.map((alert) => (
            <Marker
              key={alert._id}
              position={[alert.location.coordinates[1], alert.location.coordinates[0]]}
              icon={createIncidentMarkerIcon(alert.severity, { size: 20 })}
            >
              <Popup className="incident-popup">
                <div className="w-64">
                  {alert.mediaUrls && alert.mediaUrls.length > 0 && (
                    <img
                      src={alert.mediaUrls[0]}
                      alt={alert.title}
                      className="h-24 w-full object-cover rounded-t-md mb-2"
                    />
                  )}
                  <h3 className="font-bold text-lg truncate mb-1" title={alert.title}>
                    {alert.title}
                  </h3>
                  <div className="flex flex-wrap gap-1 mb-2">
                    <Badge variant="outline" className="text-xs">
                      {getIncidentCategoryLabel(alert.category, language)}
                    </Badge>
                    <Badge
                      style={{
                        backgroundColor: SEVERITY_COLORS[alert.severity ?? 'low'],
                        color: 'white',
                      }}
                      className="text-xs"
                    >
                      {severityFilterLabel(alert.severity ?? 'low')}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {getIncidentStatusLabel(alert.status, language)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {format(new Date(alert.createdAt), 'dd/MM/yyyy')}
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

      {/* Severity Filter Overlay */}
      <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2 bg-background/80 backdrop-blur-sm p-2 rounded-lg shadow-md border border-border">
        {(['all', 'critical', 'high', 'medium', 'low'] as const).map((sev) => (
          <button
            key={sev}
            onClick={() => setSeverityFilter(sev)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-between gap-3',
              severityFilter === sev
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted bg-background'
            )}
          >
            <span>{severityFilterLabel(sev)}</span>
            <Badge variant={severityFilter === sev ? 'secondary' : 'outline'} className="ml-2 py-0 h-5">
              {severityCounts[sev]}
            </Badge>
          </button>
        ))}
      </div>

      {/* Legend Overlay */}
      <div className="absolute bottom-4 left-4 z-[400] bg-background/90 backdrop-blur-sm p-3 rounded-lg shadow-md border border-border text-sm">
        <p className="font-semibold mb-2 text-xs text-muted-foreground uppercase tracking-wider">CHÚ GIẢI</p>
        <div className="space-y-2">
          {(Object.entries(SEVERITY_COLORS) as Array<[Severity, string]>).map(([sev, color]) => (
            <div key={sev} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs font-medium">{severityLegendLabel(sev)}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
             <div className="relative flex h-4 w-4">
               <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
               <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500 border-2 border-white"></span>
             </div>
             <span className="text-xs font-medium">Vị trí của bạn</span>
          </div>
        </div>
      </div>
    </div>
  );
};
