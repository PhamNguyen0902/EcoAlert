import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import type { HeatLatLngTuple } from 'leaflet';
import { Flame, Info, Loader2, MapPin, X } from 'lucide-react';
import { Marker, MapContainer, Popup, TileLayer, Tooltip, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { HeatmapLayer } from '@/components/map/HeatmapLayer';
import {
  SeverityBadge,
  StatusBadge,
  formatIncidentCategory,
} from '@/components/incidents/incident-status';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  densityLayerVisibility,
  getDensityPointLatLng,
  incidentDetailHref,
  incidentReportCode,
  normalizeDensitySummary,
  toDensityHeatPoint,
  type AdminDensityMapMode,
} from '@/lib/admin-incident-density';
import { formatMapLabel } from '@/lib/gis-heatmap';
import {
  createIncidentClusterIcon,
  createIncidentMarkerIcon,
} from '@/lib/incident-map-marker';
import { gisService } from '@/services/services';
import type { HeatmapDrilldown, HeatmapPoint, IncidentHeatmap } from '@/types';

const DEFAULT_CENTER: [number, number] = [10.762622, 106.660172];
const DRILLDOWN_RADIUS_METERS = 750;
const CATEGORY_OPTIONS = [
  'illegal_dumping',
  'water_pollution',
  'air_pollution',
  'illegal_burning',
  'flooding',
  'fallen_tree',
  'illegal_construction_waste',
  'noise_pollution',
  'soil_contamination',
  'wildlife_threat',
  'other',
] as const;
const MAP_MODES: ReadonlyArray<{ mode: AdminDensityMapMode; labelKey: string }> = [
  { mode: 'heatmap', labelKey: 'incident_density.mode_heatmap' },
  { mode: 'incidents', labelKey: 'incident_density.mode_incidents' },
  { mode: 'combined', labelKey: 'incident_density.mode_combined' },
];

type DrilldownCenter = { lat: number; lng: number } | null;

function DensityClickHandler({ onSelect }: { onSelect: (center: { lat: number; lng: number }) => void }) {
  useMapEvents({ click: (event) => onSelect({ lat: event.latlng.lat, lng: event.latlng.lng }) });
  return null;
}

const cleanFilters = (filters: Record<string, string>) => Object.fromEntries(
  Object.entries(filters).filter(([, value]) => value && value !== 'all'),
);

export default function AdminIncidentHeatmap() {
  const { t } = useLanguage();
  const [filters, setFilters] = useState<Record<string, string>>({
    category: 'all',
    severity: 'all',
    status: 'active',
    from: '',
    to: '',
  });
  const [mapMode, setMapMode] = useState<AdminDensityMapMode>('combined');
  const [drilldownCenter, setDrilldownCenter] = useState<DrilldownCenter>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const queryFilters = useMemo(() => cleanFilters(filters), [filters]);
  const { data, isLoading, isError } = useQuery<IncidentHeatmap>({
    queryKey: ['admin-incident-density', queryFilters],
    queryFn: () => gisService.getIncidentHeatmap(queryFilters),
  });
  const drilldown = useQuery<HeatmapDrilldown>({
    queryKey: ['admin-incident-density-drilldown', drilldownCenter, queryFilters],
    queryFn: () => gisService.getIncidentDrilldown(
      drilldownCenter!.lat,
      drilldownCenter!.lng,
      DRILLDOWN_RADIUS_METERS,
      queryFilters,
    ),
    enabled: Boolean(drilldownCenter),
  });
  const mapIncidents = useMemo(
    () => (data?.points ?? []).flatMap((point) =>
      getDensityPointLatLng(point) ? [point] : []),
    [data],
  );
  const heatPoints = useMemo<HeatLatLngTuple[]>(
    () => mapIncidents.flatMap((point) => {
      const heatPoint = toDensityHeatPoint(point);
      return heatPoint ? [heatPoint] : [];
    }),
    [mapIncidents],
  );
  const mapLayers = densityLayerVisibility(mapMode);
  const summary = data?.summary;
  const normalizedSummary = useMemo(() => normalizeDensitySummary(summary), [summary]);
  const normalizedDrilldownSummary = useMemo(
    () => normalizeDensitySummary(drilldown.data?.summary),
    [drilldown.data?.summary],
  );
  const highlightedIncidentIds = useMemo(
    () => new Set(drilldown.data?.incidents.map((incident) => incident.alertId) ?? []),
    [drilldown.data?.incidents],
  );
  const setFilter = (key: string, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const formatReportedAt = (value?: string) => {
    if (!value || Number.isNaN(new Date(value).getTime())) return t('incident_density.unknown');
    return format(new Date(value), 'dd/MM/yyyy HH:mm');
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Flame className="h-6 w-6 text-orange-500" />{t('incident_density.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('incident_density.subtitle')}</p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-5">
            <label className="text-xs font-medium text-muted-foreground">{t('incident_density.category')}
              <select className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm text-foreground" value={filters.category} onChange={(event) => setFilter('category', event.target.value)}>
                <option value="all">{t('incident_density.all_categories')}</option>
                {CATEGORY_OPTIONS.map((value) => <option key={value} value={value}>{formatMapLabel(value)}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">{t('incident_density.severity')}
              <select className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm text-foreground" value={filters.severity} onChange={(event) => setFilter('severity', event.target.value)}>
                <option value="all">{t('incident_density.all_severities')}</option>
                <option value="critical">{t('incident_density.severity_critical')}</option>
                <option value="high">{t('incident_density.severity_high')}</option>
                <option value="medium">{t('incident_density.severity_medium')}</option>
                <option value="low">{t('incident_density.severity_low')}</option>
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">{t('incident_density.status')}
              <select className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm text-foreground" value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
                <option value="all">{t('incident_density.all_statuses')}</option>
                <option value="active">{t('incident_density.status_active')}</option>
                <option value="resolved">{t('incident_density.status_resolved')}</option>
                <option value="closed">{t('incident_density.status_closed')}</option>
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">{t('incident_density.from')}
              <input className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm text-foreground" type="date" value={filters.from} onChange={(event) => setFilter('from', event.target.value)} />
            </label>
            <label className="text-xs font-medium text-muted-foreground">{t('incident_density.to')}
              <input className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm text-foreground" type="date" value={filters.to} onChange={(event) => setFilter('to', event.target.value)} />
            </label>
          </div>
          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium">{t('incident_density.map_mode')}</p>
            <div className="inline-flex w-full rounded-lg border bg-muted/40 p-1 sm:w-auto" role="group" aria-label={t('incident_density.map_mode')}>
              {MAP_MODES.map(({ mode, labelKey }) => (
                <Button
                  key={mode}
                  type="button"
                  size="sm"
                  variant={mapMode === mode ? 'default' : 'ghost'}
                  className="flex-1 sm:flex-none"
                  aria-pressed={mapMode === mode}
                  onClick={() => setMapMode(mode)}
                >
                  {t(labelKey)}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="incident-density-map min-h-[600px] overflow-hidden rounded-xl border bg-muted">
          <MapContainer center={DEFAULT_CENTER} zoom={12} className="h-[600px] w-full">
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <DensityClickHandler onSelect={setDrilldownCenter} />
            {mapLayers.heatmap && heatPoints.length > 0 ? <HeatmapLayer points={heatPoints} /> : null}
            <MarkerClusterGroup
              chunkedLoading
              iconCreateFunction={createIncidentClusterIcon}
              maxClusterRadius={40}
            >
              {mapLayers.incidents
                ? mapIncidents.map((incident) => (
                    <IncidentMarker
                      key={incident.incidentId}
                      incident={incident}
                      emphasized={selectedIncidentId === incident.incidentId || highlightedIncidentIds.has(incident.incidentId)}
                      onSelect={setSelectedIncidentId}
                      formatReportedAt={formatReportedAt}
                      labels={{
                        category: t('incident_density.category'),
                        severity: t('incident_density.severity'),
                        status: t('incident_density.status'),
                        reported: t('incident_density.reported'),
                        address: t('incident_density.address'),
                        coordinates: t('incident_density.coordinates'),
                        viewIncident: t('incident_density.view_incident'),
                        untitled: t('incident_density.untitled'),
                        unknownAddress: t('incident_density.unknown_address'),
                      }}
                    />
                  ))
                : null}
            </MarkerClusterGroup>
          </MapContainer>
          {isLoading ? <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/65"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : null}
          {isError ? <div role="alert" className="absolute left-4 top-4 z-10 rounded-md border border-destructive/40 bg-background p-3 text-sm text-destructive">{t('incident_density.load_error')}</div> : null}
          {!isLoading && !isError && mapIncidents.length === 0 ? <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-md border bg-background p-3 text-sm shadow">{t('incident_density.empty')}</div> : null}
          <div className="pointer-events-none absolute bottom-4 left-4 z-10 max-w-xs rounded-lg border bg-background/95 p-3 text-xs shadow">
            <div className="mb-1 flex items-center gap-1.5 font-semibold"><Info className="h-4 w-4 text-orange-500" />{t('incident_density.map_instruction')}</div>
            <p className="text-muted-foreground">{t('incident_density.map_explanation')}</p>
          </div>
        </section>

        <Card>
          <CardHeader><CardTitle>{t('incident_density.operational_summary')}</CardTitle><CardDescription>{t('incident_density.operational_summary_description')}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Metric label={t('incident_density.total')} value={summary?.total ?? 0} />
              <Metric label={t('incident_density.open')} value={summary?.open ?? 0} />
              <Metric label={t('incident_density.resolved')} value={summary?.resolved ?? 0} />
              <Metric label={t('incident_density.closed')} value={summary?.closed ?? 0} />
            </div>
            <SummaryGroup title={t('incident_density.by_severity')} entries={normalizedSummary.bySeverity} renderLabel={(severity) => <SeverityBadge severity={severity} />} />
            <SummaryGroup title={t('incident_density.by_category')} entries={normalizedSummary.byCategory} renderLabel={(category) => <span className="text-sm">{formatIncidentCategory(category)}</span>} />
          </CardContent>
        </Card>
      </div>

      {drilldownCenter ? (
        <Card aria-live="polite">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>{t('incident_density.selected_area')}</CardTitle>
              <CardDescription>{t('incident_density.nearby_description').replace('{radius}', String(DRILLDOWN_RADIUS_METERS))}</CardDescription>
            </div>
            <Button type="button" size="icon" variant="ghost" onClick={() => setDrilldownCenter(null)} aria-label={t('incident_density.close')}><X className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent>
            {drilldown.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <Metric label={t('incident_density.total')} value={drilldown.data?.summary.total ?? 0} />
                    <Metric label={t('incident_density.open')} value={drilldown.data?.summary.open ?? 0} />
                  </div>
                  <SummaryGroup title={t('incident_density.by_severity')} entries={normalizedDrilldownSummary.bySeverity} renderLabel={(severity) => <SeverityBadge severity={severity} />} />
                </div>
                <div className="max-h-[420px] space-y-3 overflow-auto pr-1">
                  {(drilldown.data?.incidents ?? []).map((incident) => (
                    <div key={incident.alertId} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-primary">{incidentReportCode(incident.alertId)}</p>
                          <p className="mt-1 break-words font-medium">{incident.title || t('incident_density.untitled')}</p>
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" />{incident.address || t('incident_density.unknown_address')} · {Math.round(incident.distanceMeters)} m</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1"><SeverityBadge severity={incident.severity} /><StatusBadge status={incident.status} /></div>
                      </div>
                      <Button asChild size="sm" variant="outline" className="mt-3"><Link to={incidentDetailHref(incident.alertId)}>{t('incident_density.view_incident')}</Link></Button>
                    </div>
                  ))}
                  {!drilldown.data?.incidents.length ? <p className="py-8 text-center text-sm text-muted-foreground">{t('incident_density.no_nearby')}</p> : null}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function IncidentMarker({
  incident,
  emphasized,
  onSelect,
  formatReportedAt,
  labels,
}: {
  incident: HeatmapPoint;
  emphasized: boolean;
  onSelect: (incidentId: string) => void;
  formatReportedAt: (value?: string) => string;
  labels: Record<'category' | 'severity' | 'status' | 'reported' | 'address' | 'coordinates' | 'viewIncident' | 'untitled' | 'unknownAddress', string>;
}) {
  const position = getDensityPointLatLng(incident);
  if (!position) return null;

  return (
    <Marker
      position={position}
      icon={createIncidentMarkerIcon(incident.severity, { emphasized })}
      zIndexOffset={emphasized ? 1_000 : 0}
      eventHandlers={{ click: () => onSelect(incident.incidentId) }}
    >
      <Tooltip direction="top" offset={[0, -14]}>{incidentReportCode(incident.incidentId)} · {incident.title || labels.untitled}</Tooltip>
      <Popup className="ecoalert-map-popup" minWidth={255} maxWidth={320}>
        <div className="w-64 space-y-3">
          <div><p className="text-xs font-semibold text-primary">{incidentReportCode(incident.incidentId)}</p><h2 className="mt-1 break-words text-base font-semibold">{incident.title || labels.untitled}</h2></div>
          <dl className="space-y-2 text-xs">
            <PopupDetail label={labels.category}>{formatIncidentCategory(incident.category)}</PopupDetail>
            <PopupDetail label={labels.severity}><SeverityBadge severity={incident.severity} className="px-2 py-0.5 text-[11px]" /></PopupDetail>
            <PopupDetail label={labels.status}><StatusBadge status={incident.status} className="px-2 py-0.5 text-[11px]" /></PopupDetail>
            <PopupDetail label={labels.reported}>{formatReportedAt(incident.createdAt)}</PopupDetail>
            <PopupDetail label={labels.address}>{incident.address || labels.unknownAddress}</PopupDetail>
            <PopupDetail label={labels.coordinates}>{position[0].toFixed(6)}, {position[1].toFixed(6)}</PopupDetail>
          </dl>
          <Button asChild size="sm" className="w-full"><Link to={incidentDetailHref(incident.incidentId)}>{labels.viewIncident}</Link></Button>
        </div>
      </Popup>
    </Marker>
  );
}

function PopupDetail({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex items-start justify-between gap-3"><dt className="shrink-0 text-muted-foreground">{label}</dt><dd className="text-right font-medium">{children}</dd></div>;
}

function SummaryGroup({ title, entries, renderLabel }: { title: string; entries: Array<[string, number]>; renderLabel: (code: string) => ReactNode }) {
  return <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p><div className="max-h-48 space-y-2 overflow-auto">{entries.map(([code, count]) => <div key={code} className="flex items-center justify-between gap-3"><div className="min-w-0">{renderLabel(code)}</div><strong className="shrink-0 text-sm">{count}</strong></div>)}</div></div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p></div>;
}
