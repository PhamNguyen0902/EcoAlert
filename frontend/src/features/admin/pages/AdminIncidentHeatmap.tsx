import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import { Flame, Info, Loader2, MapPin } from 'lucide-react';
import type L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { HeatmapLayer } from '@/components/map/HeatmapLayer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { gisService } from '@/services/services';
import type { HeatmapDrilldown, IncidentHeatmap } from '@/types';

const DEFAULT_CENTER: [number, number] = [10.762622, 106.660172];
const CATEGORY_OPTIONS = ['illegal_dumping', 'water_pollution', 'air_pollution', 'illegal_burning', 'flooding', 'fallen_tree', 'illegal_construction_waste', 'noise_pollution', 'soil_contamination', 'wildlife_threat', 'other'];

type DrilldownCenter = { lat: number; lng: number } | null;

function DensityClickHandler({ onSelect }: { onSelect: (center: { lat: number; lng: number }) => void }) {
  useMapEvents({ click: (event) => onSelect({ lat: event.latlng.lat, lng: event.latlng.lng }) });
  return null;
}

const cleanFilters = (filters: Record<string, string>) => Object.fromEntries(
  Object.entries(filters).filter(([, value]) => value && value !== 'all'),
);

export default function AdminIncidentHeatmap() {
  const [filters, setFilters] = useState<Record<string, string>>({ category: 'all', severity: 'all', status: 'active', from: '', to: '' });
  const [drilldownCenter, setDrilldownCenter] = useState<DrilldownCenter>(null);
  const queryFilters = useMemo(() => cleanFilters(filters), [filters]);
  const { data, isLoading, isError } = useQuery<IncidentHeatmap>({
    queryKey: ['admin-incident-density', queryFilters],
    queryFn: () => gisService.getIncidentHeatmap(queryFilters),
  });
  const drilldown = useQuery<HeatmapDrilldown>({
    queryKey: ['admin-incident-density-drilldown', drilldownCenter, queryFilters],
    queryFn: () => gisService.getIncidentDrilldown(drilldownCenter!.lat, drilldownCenter!.lng, 750, queryFilters),
    enabled: Boolean(drilldownCenter),
  });
  const points = useMemo(
    () => (data?.points ?? []).map((point) => [point.lat, point.lng, point.weight] as L.HeatLatLngTuple),
    [data],
  );
  const summary = data?.summary;
  const setFilter = (key: string, value: string) => setFilters((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Flame className="h-6 w-6 text-orange-500" />Incident Density</h1>
        <p className="mt-1 text-sm text-muted-foreground">Operational density of real reported incidents. Color intensity represents incident concentration, not temperature or a prediction.</p>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-5">
          <label className="text-xs font-medium text-muted-foreground">Category
            <select className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm text-foreground" value={filters.category} onChange={(event) => setFilter('category', event.target.value)}>
              <option value="all">All categories</option>{CATEGORY_OPTIONS.map((value) => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">Severity
            <select className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm text-foreground" value={filters.severity} onChange={(event) => setFilter('severity', event.target.value)}>
              <option value="all">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">Status
            <select className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm text-foreground" value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
              <option value="all">All statuses</option><option value="active">Open operational work</option><option value="resolved">Resolved</option><option value="closed">Closed</option>
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">From
            <input className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm text-foreground" type="date" value={filters.from} onChange={(event) => setFilter('from', event.target.value)} />
          </label>
          <label className="text-xs font-medium text-muted-foreground">To
            <input className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm text-foreground" type="date" value={filters.to} onChange={(event) => setFilter('to', event.target.value)} />
          </label>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        <section className="relative min-h-[600px] overflow-hidden rounded-xl border bg-muted">
          <MapContainer center={DEFAULT_CENTER} zoom={12} className="h-[600px] w-full">
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <DensityClickHandler onSelect={setDrilldownCenter} />
            {points.length > 0 ? <HeatmapLayer points={points} /> : null}
          </MapContainer>
          {isLoading ? <div className="absolute inset-0 z-[500] flex items-center justify-center bg-background/65"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : null}
          {isError ? <div className="absolute left-4 top-4 z-[500] rounded-md border border-destructive/40 bg-background p-3 text-sm text-destructive">Incident density could not be loaded.</div> : null}
          {!isLoading && !isError && points.length === 0 ? <div className="absolute left-1/2 top-4 z-[500] -translate-x-1/2 rounded-md border bg-background p-3 text-sm shadow">No reported incidents match these filters.</div> : null}
          <div className="pointer-events-none absolute bottom-4 left-4 z-[500] max-w-xs rounded-lg border bg-background/95 p-3 text-xs shadow">
            <div className="mb-1 flex items-center gap-1.5 font-semibold"><Info className="h-4 w-4 text-orange-500" />Click a location for incident drilldown</div>
            <p className="text-muted-foreground">Density is calculated from GIS alert locations and is not a weather or temperature layer.</p>
          </div>
        </section>

        <Card>
          <CardHeader><CardTitle>Operational summary</CardTitle><CardDescription>Real GIS alert records in the selected view.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Metric label="Total" value={summary?.total ?? 0} /><Metric label="Open" value={summary?.open ?? 0} /><Metric label="Resolved" value={summary?.resolved ?? 0} /><Metric label="Closed" value={summary?.closed ?? 0} />
            </div>
            <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">By severity</p><div className="space-y-2">{Object.entries(summary?.bySeverity ?? {}).map(([severity, count]) => <div key={severity} className="flex justify-between text-sm"><Badge variant="outline">{severity}</Badge><strong>{count}</strong></div>)}</div></div>
            <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">By category</p><div className="max-h-48 space-y-2 overflow-auto">{Object.entries(summary?.byCategory ?? {}).map(([category, count]) => <div key={category} className="flex justify-between text-sm"><span className="capitalize">{category.replace(/_/g, ' ')}</span><strong>{count}</strong></div>)}</div></div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(drilldownCenter)} onOpenChange={(open) => !open && setDrilldownCenter(null)}>
        <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Incident drilldown</DialogTitle><DialogDescription>Reported incidents within 750 meters of the location you selected.</DialogDescription></DialogHeader>
          {drilldown.isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : <div className="max-h-[55vh] space-y-3 overflow-auto">{(drilldown.data?.incidents ?? []).map((incident) => <div key={incident.alertId} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{incident.title || 'Untitled incident'}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{incident.address || 'Address unavailable'} · {Math.round(incident.distanceMeters)} m</p></div><div className="flex gap-1"><Badge variant="outline">{incident.severity}</Badge><Badge>{incident.status}</Badge></div></div><Button asChild size="sm" variant="outline" className="mt-3"><Link to={`/admin/reports/${incident.alertId}`}>View incident</Link></Button></div>)}{!drilldown.data?.incidents.length && !drilldown.isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">No incidents found around this point.</p> : null}</div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p></div>;
}
