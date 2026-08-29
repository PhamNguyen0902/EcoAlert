import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Loader2, MapPin, Search } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { useAlerts } from '@/hooks/hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { createIncidentMarkerIcon } from '@/lib/incident-map-marker';
import { getIncidentLatLng } from '@/lib/map-filters';
import { getIncidentSeverityLabel, getIncidentStatusLabel } from '@/lib/incident-presentation';
import type { Alert } from '@/types';

const DEFAULT_CENTER: [number, number] = [10.762622, 106.660172];

function FitMapToIncidents({ alerts }: { alerts: readonly Alert[] }) {
  const map = useMap();

  useEffect(() => {
    const coordinates = alerts
      .map(getIncidentLatLng)
      .filter((coordinate): coordinate is [number, number] => coordinate !== null);

    if (coordinates.length === 0) return;

    if (coordinates.length === 1) {
      map.setView(coordinates[0], 15);
      return;
    }

    map.fitBounds(coordinates, { padding: [48, 48], maxZoom: 15 });
  }, [alerts, map]);

  return null;
}

// Hiển thị các báo cáo có tọa độ thật để Admin mở nhanh hồ sơ cần xác minh
export default function AdminGisMap() {
  const { language } = useLanguage();
  const { data, isLoading } = useAlerts(1, 1000);
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLowerCase();

  const alerts = useMemo(
    () =>
      (data?.items ?? []).filter((alert) => {
        const haystack = `${alert.title} ${alert.address ?? ''} ${alert.category ?? ''}`.toLowerCase();
        return getIncidentLatLng(alert) && haystack.includes(normalizedSearch);
      }),
    [data?.items, normalizedSearch],
  );

  if (isLoading) {
    return <div className="flex h-[calc(100vh-8rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const copy = language === 'vi'
    ? { title: 'Bản đồ GIS', subtitle: 'Vị trí thực tế của các báo cáo để xác minh và điều phối.', search: 'Tìm báo cáo hoặc địa chỉ...', showing: 'Đang hiển thị', incidents: 'báo cáo', view: 'Xem hồ sơ' }
    : { title: 'GIS Map', subtitle: 'Reported locations for verification and coordination.', search: 'Search reports or addresses...', showing: 'Showing', incidents: 'reports', view: 'View report' };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4 xl:h-[calc(100vh-8rem)] xl:flex-row">
      <aside className="w-full shrink-0 rounded-xl border bg-card p-4 shadow-sm xl:w-80">
        <h2 className="text-2xl font-bold tracking-tight">{copy.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>
        <div className="relative mt-5">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input type="search" aria-label={copy.search} placeholder={copy.search} className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <p className="mt-4 text-xs text-muted-foreground" aria-live="polite">{copy.showing} {alerts.length} {copy.incidents}.</p>
      </aside>

      <section className="relative isolate z-0 min-h-[60vh] flex-1 overflow-hidden rounded-xl border bg-muted shadow-sm">
        <MapContainer center={DEFAULT_CENTER} zoom={12} className="h-full min-h-[60vh] w-full">
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitMapToIncidents alerts={alerts} />
          <MarkerClusterGroup chunkedLoading maxClusterRadius={40}>
            {alerts.map((alert) => {
              const coordinates = getIncidentLatLng(alert);
              if (!coordinates) return null;
              return (
                <Marker key={alert._id} position={coordinates} icon={createIncidentMarkerIcon(alert.severity)}>
                  <Popup>
                    <div className="max-w-xs p-1">
                      <h3 className="mb-1 line-clamp-1 text-sm font-semibold">{alert.title}</h3>
                      <div className="mb-2 flex gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase">{getIncidentSeverityLabel(alert.severity, language)}</Badge>
                        <Badge variant="secondary" className="text-[10px] uppercase">{getIncidentStatusLabel(alert.status, language)}</Badge>
                      </div>
                      <p className="mb-3 flex items-start gap-1 text-xs text-muted-foreground"><MapPin className="mt-0.5 h-3 w-3 shrink-0" /><span className="line-clamp-2">{alert.address}</span></p>
                      <Button asChild size="sm" className="h-7 w-full text-xs"><Link to={`/admin/reports/${alert._id}`}>{copy.view}</Link></Button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MarkerClusterGroup>
        </MapContainer>
        {alerts.length === 0 ? <div className="pointer-events-none absolute left-1/2 top-4 z-[500] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-lg border bg-background/90 px-4 py-3 text-center text-sm font-medium shadow-lg">{language === 'vi' ? 'Không có báo cáo phù hợp có tọa độ hợp lệ.' : 'No matching reports have valid coordinates.'}</div> : null}
      </section>
    </div>
  );
}
