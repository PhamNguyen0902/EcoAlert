import { useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Link } from 'react-router-dom';
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

const DEFAULT_CENTER: [number, number] = [10.762622, 106.660172];

/** Bản đồ Officer chỉ hiển thị marker cụm và mở trực tiếp nhiệm vụ được giao. */
export default function OfficerMap() {
  const { t, language } = useLanguage(); const { data, isLoading } = useAlerts(1, 1000); const [search, setSearch] = useState('');
  const alerts = useMemo(() => (data?.items ?? []).filter((alert) => {
    const haystack = `${alert.title} ${alert.address ?? ''} ${alert.category ?? ''}`.toLowerCase();
    return getIncidentLatLng(alert) && haystack.includes(search.trim().toLowerCase());
  }), [data?.items, search]);
  if (isLoading) return <div className="flex h-[calc(100vh-8rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  return <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4 xl:h-[calc(100vh-8rem)] xl:flex-row"><aside className="w-full shrink-0 rounded-xl border bg-card p-4 shadow-sm xl:w-80"><h2 className="text-2xl font-bold tracking-tight">{t('officer.map')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('map.subtitle')}</p><div className="relative mt-5"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input type="search" aria-label={t('map.search_location')} placeholder={t('map.search_location')} className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} /></div><p className="mt-4 text-xs text-muted-foreground" aria-live="polite">{t('map.showing')} {alerts.length} {t('map.incidents')}.</p></aside><section className="relative min-h-[60vh] flex-1 overflow-hidden rounded-xl border bg-muted shadow-sm"><MapContainer center={DEFAULT_CENTER} zoom={12} className="h-full min-h-[60vh] w-full"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><MarkerClusterGroup chunkedLoading maxClusterRadius={40}>{alerts.map((alert) => { const coordinates = getIncidentLatLng(alert); if (!coordinates) return null; return <Marker key={alert._id} position={coordinates} icon={createIncidentMarkerIcon(alert.severity)}><Popup><div className="max-w-xs p-1"><h3 className="mb-1 line-clamp-1 text-sm font-semibold">{alert.title}</h3><div className="mb-2 flex gap-2"><Badge variant="outline" className="text-[10px] uppercase">{getIncidentSeverityLabel(alert.severity, language)}</Badge><Badge variant="secondary" className="text-[10px] uppercase">{getIncidentStatusLabel(alert.status, language)}</Badge></div><p className="mb-3 flex items-start gap-1 text-xs text-muted-foreground"><MapPin className="mt-0.5 h-3 w-3 shrink-0" /><span className="line-clamp-2">{alert.address}</span></p><Button asChild size="sm" className="h-7 w-full text-xs"><Link to={`/officer/reports/${alert._id}`}>{t('btn.view')}</Link></Button></div></Popup></Marker>; })}</MarkerClusterGroup></MapContainer>{alerts.length === 0 ? <div className="pointer-events-none absolute left-1/2 top-4 z-[500] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-lg border bg-background/90 px-4 py-3 text-center text-sm font-medium shadow-lg">{t('map.no_matches')}</div> : null}</section></div>;
}
