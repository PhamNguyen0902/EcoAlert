import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  getIncidentCategoryLabel,
  getIncidentSeverityLabel,
  getIncidentStatusLabel,
} from '@/lib/incident-presentation';
import type { Alert } from '@/types';

const DEFAULT_CENTER: [number, number] = [10.762622, 106.660172];
const EMPTY_ALERTS: Alert[] = [];

function FitInitialMarkerBounds({ incidents }: { incidents: readonly Alert[] }) {
  const map = useMap();
  const hasFitted = useRef(false);

  useEffect(() => {
    if (hasFitted.current) return;

    const coordinates = incidents
      .map(getIncidentLatLng)
      .filter((coordinate): coordinate is [number, number] => coordinate !== null);

    if (coordinates.length === 0) return;

    hasFitted.current = true;
    if (coordinates.length === 1) {
      map.setView(coordinates[0], 15);
      return;
    }

    map.fitBounds(coordinates, { padding: [48, 48], maxZoom: 15 });
  }, [incidents, map]);

  return null;
}

/** Bản đồ giám sát các sự cố được phân công cho Officer đang đăng nhập. */
export default function OfficerMap() {
  const { t, language } = useLanguage();
  const { data, isLoading } = useAlerts(1, 1000);
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLowerCase();
  const incidents = data?.items ?? EMPTY_ALERTS;

  // GeoJSON dùng [longitude, latitude], còn Leaflet cần [latitude, longitude].
  const validIncidents = useMemo(
    () => incidents.filter((incident) => getIncidentLatLng(incident) !== null),
    [incidents],
  );

  const visibleIncidents = useMemo(
    () => validIncidents.filter((incident) => {
      const haystack = `${incident.title} ${incident.address ?? ''} ${incident.category ?? ''}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    }),
    [validIncidents, normalizedSearch],
  );

  if (isLoading) {
    return <div className="flex h-[calc(100vh-8rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const emptyMessage = incidents.length > 0 && validIncidents.length === 0
    ? (language === 'vi' ? 'Các sự cố hiện tại chưa có tọa độ hợp lệ để hiển thị trên bản đồ.' : 'Current incidents do not have valid coordinates for the map.')
    : t('map.no_matches');

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4 xl:h-[calc(100vh-8rem)] xl:flex-row">
      <aside className="w-full shrink-0 rounded-xl border bg-card p-4 shadow-sm xl:w-80">
        <h2 className="text-2xl font-bold tracking-tight">{t('officer.map')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('map.subtitle')}</p>
        <div className="relative mt-5">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            aria-label={t('map.search_location')}
            placeholder={t('map.search_location')}
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <p className="mt-4 text-xs text-muted-foreground" aria-live="polite">
          {t('map.showing')} {visibleIncidents.length} {t('map.incidents')}.
        </p>
      </aside>

      <section className="relative isolate z-0 min-h-[60vh] flex-1 overflow-hidden rounded-xl border bg-muted shadow-sm">
        <MapContainer center={DEFAULT_CENTER} zoom={12} className="h-full min-h-[60vh] w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitInitialMarkerBounds incidents={validIncidents} />
          <MarkerClusterGroup chunkedLoading maxClusterRadius={40}>
            {visibleIncidents.map((incident) => {
              const coordinates = getIncidentLatLng(incident);
              if (!coordinates) return null;

              return (
                <Marker key={incident._id} position={coordinates} icon={createIncidentMarkerIcon(incident.severity)}>
                  <Popup>
                    <div className="max-w-xs p-1">
                      <h3 className="mb-1 line-clamp-1 text-sm font-semibold">{incident.title}</h3>
                      <div className="mb-2 flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase">{getIncidentCategoryLabel(incident.category, language)}</Badge>
                        <Badge variant="outline" className="text-[10px] uppercase">{getIncidentSeverityLabel(incident.severity, language)}</Badge>
                        <Badge variant="secondary" className="text-[10px] uppercase">{getIncidentStatusLabel(incident.status, language)}</Badge>
                      </div>
                      <p className="mb-3 flex items-start gap-1 text-xs text-muted-foreground"><MapPin className="mt-0.5 h-3 w-3 shrink-0" /><span className="line-clamp-2">{incident.address}</span></p>
                      <Button asChild size="sm" className="h-7 w-full text-xs"><Link to={`/officer/reports/${incident._id}`}>{t('btn.view')}</Link></Button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MarkerClusterGroup>
        </MapContainer>
        {visibleIncidents.length === 0 ? <div className="pointer-events-none absolute left-1/2 top-4 z-[500] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-lg border bg-background/90 px-4 py-3 text-center text-sm font-medium shadow-lg">{emptyMessage}</div> : null}
      </section>
    </div>
  );
}
