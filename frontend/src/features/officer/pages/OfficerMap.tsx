import { useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Link } from 'react-router-dom';
import { Flame, Info, Loader2, MapPin, Search } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAlerts } from '@/hooks/hooks';
import type { Alert, Severity } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { HeatmapLayer } from '@/components/map/HeatmapLayer';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { useGeolocation } from '@/features/citizen/hooks/useGeolocation';
import {
  buildHeatPoints,
  countIncidentsBySeverity,
  filterIncidentsForMap,
  formatMapLabel,
  getIncidentLatLng,
  MapCategoryFilter,
  MapDateRangeFilter,
  MapRadiusFilter,
  MapSeverityFilter,
  MapStatusFilter,
  MapVisualizationMode,
  normalizeMapCategory,
  normalizeSeverity,
  SEVERITY_COLORS,
  SEVERITY_ORDER,
} from '@/lib/gis-heatmap';

delete (L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const DEFAULT_CENTER: [number, number] = [10.762622, 106.660172];

const createCustomIcon = (severity: Severity) => {
  const normalizedSeverity = normalizeSeverity(severity) ?? 'low';
  const color = SEVERITY_COLORS[normalizedSeverity];

  return L.divIcon({
    className: 'custom-icon',
    html: `<div style="background:${color};width:18px;height:18px;border-radius:9999px;border:2px solid white;box-shadow:0 3px 8px rgba(15,23,42,.35)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
};

const severityTranslationKey: Record<Severity, string> = {
  critical: 'map.critical',
  high: 'map.high',
  medium: 'map.medium',
  low: 'map.low',
};

export default function OfficerMap() {
  const { t } = useLanguage();
  const { data, isLoading } = useAlerts(1, 1000);
  const { latitude: userLat, longitude: userLng } = useGeolocation();
  const userCoords = useMemo<[number, number] | null>(
    () => (userLat !== null && userLng !== null ? [userLat, userLng] : null),
    [userLat, userLng],
  );

  const [mode, setMode] = useState<MapVisualizationMode>('markers');
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<MapSeverityFilter>('all');
  const [category, setCategory] = useState<MapCategoryFilter>('all');
  const [status, setStatus] = useState<MapStatusFilter>('all');
  const [dateRange, setDateRange] = useState<MapDateRangeFilter>('all');
  const [radius, setRadius] = useState<MapRadiusFilter>('all');

  const alerts = data?.items ?? [];
  const mappableAlerts = useMemo(
    () => alerts.filter((alert) => getIncidentLatLng(alert) !== null),
    [alerts],
  );
  const availableCategories = useMemo(
    () =>
      Array.from(
        new Set(
          mappableAlerts
            .map((alert) => normalizeMapCategory(alert.category))
            .filter(Boolean),
        ),
      ).sort(),
    [mappableAlerts],
  );
  const severityBaseAlerts = useMemo(
    () => filterIncidentsForMap(mappableAlerts, {
      search,
      severity: 'all',
      category,
      status,
      dateRange,
      radius,
      userCoords,
    }),
    [mappableAlerts, search, category, status, dateRange, radius, userCoords],
  );
  const filteredAlerts = useMemo(
    () => filterIncidentsForMap(severityBaseAlerts, {
      search: '',
      severity,
      category: 'all',
      status: 'all',
      dateRange: 'all',
      radius: 'all',
    }),
    [severityBaseAlerts, severity],
  );
  const severityCounts = useMemo(
    () => countIncidentsBySeverity(severityBaseAlerts),
    [severityBaseAlerts],
  );
  const visibleSeverityCounts = useMemo(
    () => countIncidentsBySeverity(filteredAlerts),
    [filteredAlerts],
  );
  const heatPoints = useMemo(() => buildHeatPoints(filteredAlerts), [filteredAlerts]);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4 xl:h-[calc(100vh-8rem)] xl:min-h-0 xl:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground shadow-sm xl:w-80 xl:overflow-y-auto">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('officer.map')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('map.subtitle')}</p>
        </div>

        <div
          className="grid grid-cols-2 rounded-lg border bg-muted/50 p-1"
          role="group"
          aria-label={t('map.visualization_mode')}
        >
          <button
            type="button"
            aria-pressed={mode === 'markers'}
            onClick={() => setMode('markers')}
            className={cn(
              'flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              mode === 'markers'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <MapPin className="h-4 w-4" />
            {t('map.marker_view')}
          </button>
          <button
            type="button"
            aria-pressed={mode === 'heatmap'}
            onClick={() => setMode('heatmap')}
            className={cn(
              'flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              mode === 'heatmap'
                ? 'bg-orange-500 text-white shadow-sm hover:bg-orange-600'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Flame className="h-4 w-4" />
            {t('map.heatmap_view')}
          </button>
        </div>

        {mode === 'heatmap' && (
          <div className="flex items-start gap-2 rounded-lg border border-orange-500/25 bg-orange-500/10 p-3 text-xs text-muted-foreground">
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="shrink-0 rounded-full text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-orange-400"
                    aria-label={t('map.heatmap_explanation')}
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-64">
                  {t('map.heatmap_explanation')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span>{t('map.heatmap_explanation')}</span>
          </div>
        )}

        <div className="relative">
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

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            <span>{t('map.category')}</span>
            <Select
              value={category}
              onValueChange={(value) => setCategory(value as MapCategoryFilter)}
            >
              <SelectTrigger aria-label={t('map.category')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('map.all_categories')}</SelectItem>
                {availableCategories.map((value) => (
                  <SelectItem key={value} value={value}>
                    {formatMapLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            <span>{t('map.status')}</span>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as MapStatusFilter)}
            >
              <SelectTrigger aria-label={t('map.status')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('map.all_statuses')}</SelectItem>
                <SelectItem value="active">{t('map.active_incidents')}</SelectItem>
                <SelectItem value="resolved">{t('status.resolved')}</SelectItem>
                <SelectItem value="closed">{t('map.closed')}</SelectItem>
              </SelectContent>
            </Select>
          </label>

          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            <span>Thời gian</span>
            <Select
              value={dateRange}
              onValueChange={(value) => setDateRange(value as MapDateRangeFilter)}
            >
              <SelectTrigger aria-label="Thời gian">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả thời gian</SelectItem>
                <SelectItem value="today">Hôm nay (24h)</SelectItem>
                <SelectItem value="7days">7 ngày qua</SelectItem>
                <SelectItem value="30days">30 ngày qua</SelectItem>
              </SelectContent>
            </Select>
          </label>

          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            <span>Bán kính vị trí</span>
            <Select
              value={radius}
              onValueChange={(value) => setRadius(value as MapRadiusFilter)}
            >
              <SelectTrigger aria-label="Bán kính vị trí">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toàn bộ vùng</SelectItem>
                <SelectItem value="2km">Trong bán kính 2 km</SelectItem>
                <SelectItem value="5km">Trong bán kính 5 km</SelectItem>
                <SelectItem value="10km">Trong bán kính 10 km</SelectItem>
                <SelectItem value="20km">Trong bán kính 20 km</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>

        <section aria-labelledby="severity-filter-heading">
          <h3
            id="severity-filter-heading"
            className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {t('map.filter_severity')}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {(['all', ...SEVERITY_ORDER] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={severity === value}
                onClick={() => setSeverity(value)}
                className={cn(
                  'flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  severity === value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted',
                )}
              >
                {value !== 'all' && (
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-white/80 shadow-sm"
                    style={{ backgroundColor: SEVERITY_COLORS[value] }}
                  />
                )}
                <span>
                  {value === 'all'
                    ? t('status.all')
                    : t(severityTranslationKey[value])}
                </span>
                <Badge
                  variant={severity === value ? 'secondary' : 'outline'}
                  className="ml-auto h-5 px-1.5 py-0"
                >
                  {severityCounts[value]}
                </Badge>
              </button>
            ))}
          </div>
        </section>

        {mode === 'heatmap' && (
          <section
            className="rounded-xl border bg-muted/35 p-3"
            aria-labelledby="hotspot-summary-heading"
          >
            <div className="mb-3 flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <h3 id="hotspot-summary-heading" className="text-sm font-semibold">
                {t('map.environmental_hotspots')}
              </h3>
            </div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('map.incidents_in_view')}</span>
              <strong>{visibleSeverityCounts.all}</strong>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              {SEVERITY_ORDER.map((value) => (
                <div key={value} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: SEVERITY_COLORS[value] }}
                    />
                    {t(severityTranslationKey[value])}
                  </span>
                  <strong>{visibleSeverityCounts[value]}</strong>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="text-xs text-muted-foreground" aria-live="polite">
          {t('map.showing')} {filteredAlerts.length} {t('map.incidents')}.
        </p>
      </aside>

      <section
        className="relative z-0 min-h-[60vh] flex-1 overflow-hidden rounded-xl border bg-muted shadow-sm xl:min-h-0"
        data-map-mode={mode}
        data-heat-point-count={heatPoints.length}
      >
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={12}
          className="h-full min-h-[60vh] w-full xl:min-h-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {mode === 'markers' && (
            <MarkerClusterGroup chunkedLoading maxClusterRadius={40}>
              {filteredAlerts.map((alert: Alert) => {
                const coordinates = getIncidentLatLng(alert);
                if (!coordinates) return null;

                return (
                  <Marker
                    key={alert._id}
                    position={coordinates}
                    icon={createCustomIcon(alert.severity ?? 'low')}
                  >
                    <Popup className="rounded-lg">
                      <div className="max-w-xs p-1">
                        <h3 className="mb-1 line-clamp-1 text-sm font-semibold">{alert.title}</h3>
                        <div className="mb-2 flex gap-2">
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {alert.severity ?? 'unavailable'}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] uppercase">
                            {alert.status}
                          </Badge>
                        </div>
                        <p className="mb-3 flex items-start gap-1 text-xs text-muted-foreground">
                          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                          <span className="line-clamp-2">{alert.address}</span>
                        </p>
                        <Button asChild size="sm" className="h-7 w-full text-xs">
                          <Link to={`/officer/reports/${alert._id}`}>{t('btn.view')}</Link>
                        </Button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MarkerClusterGroup>
          )}

          {mode === 'heatmap' && <HeatmapLayer points={heatPoints} />}
        </MapContainer>

        {filteredAlerts.length === 0 && (
          <div className="pointer-events-none absolute left-1/2 top-4 z-[500] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-lg border bg-background/90 px-4 py-3 text-center text-sm font-medium shadow-lg backdrop-blur">
            {t('map.no_matches')}
          </div>
        )}

        <div className="pointer-events-none absolute bottom-3 left-3 z-[500] max-w-[calc(100%-1.5rem)] rounded-xl border bg-background/90 p-3 shadow-lg backdrop-blur sm:bottom-4 sm:left-4">
          {mode === 'markers' ? (
            <>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t('map.severity_legend')}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {SEVERITY_ORDER.map((value) => (
                  <div key={value} className="flex items-center gap-2 text-xs font-medium">
                    <span
                      className="h-3 w-3 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: SEVERITY_COLORS[value] }}
                    />
                    {t(severityTranslationKey[value])}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="w-56 max-w-full">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t('map.hotspot_intensity')}
              </p>
              <div
                className="h-2.5 rounded-full"
                style={{
                  background:
                    'linear-gradient(90deg, #22C55E 0%, #EAB308 35%, #F97316 65%, #DC2626 100%)',
                }}
              />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>{t('map.intensity_low')}</span>
                <span>{t('map.intensity_moderate')}</span>
                <span>{t('map.intensity_high')}</span>
                <span>{t('map.intensity_very_high')}</span>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                {t('map.hotspot_combines')}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
