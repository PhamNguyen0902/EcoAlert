import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import {
  CircleMarker,
  MapContainer,
  Pane,
  Popup,
  TileLayer,
  Tooltip,
  useMapEvents,
} from 'react-leaflet';
import { Flame, Info, Loader2, MapPin } from 'lucide-react';
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
import { useLanguage } from '@/contexts/LanguageContext';
import {
  formatMapLabel,
  normalizeSeverity,
  SEVERITY_COLORS,
  SEVERITY_ORDER,
} from '@/lib/gis-heatmap';
import {
  densityLayerVisibility,
  getDensityPointLatLng,
  incidentReportCode,
  toDensityHeatPoint,
  type AdminDensityMapMode,
} from '@/lib/admin-incident-density';
import { gisService } from '@/services/services';
import type { HeatmapDrilldown, IncidentHeatmap } from '@/types';

const DEFAULT_CENTER: [number, number] = [10.762622, 106.660172];
const CATEGORY_OPTIONS = ['illegal_dumping', 'water_pollution', 'air_pollution', 'illegal_burning', 'flooding', 'fallen_tree', 'illegal_construction_waste', 'noise_pollution', 'soil_contamination', 'wildlife_threat', 'other'];
const UNKNOWN_SEVERITY_COLOR = '#64748B';

type DrilldownCenter = { lat: number; lng: number } | null;

function DensityClickHandler({ onSelect }: { onSelect: (center: { lat: number; lng: number }) => void }) {
  useMapEvents({ click: (event) => onSelect({ lat: event.latlng.lat, lng: event.latlng.lng }) });
  return null;
}

const cleanFilters = (filters: Record<string, string>) => Object.fromEntries(
  Object.entries(filters).filter(([, value]) => value && value !== 'all'),
);

const formatReportedAt = (value: string | undefined, language: 'vi' | 'en') => {
  if (!value || Number.isNaN(new Date(value).getTime())) return '—';
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
};

export default function AdminIncidentHeatmap() {
  const { language, t } = useLanguage();
  const [filters, setFilters] = useState<Record<string, string>>({ category: 'all', severity: 'all', status: 'active', from: '', to: '' });
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
    queryFn: () => gisService.getIncidentDrilldown(drilldownCenter!.lat, drilldownCenter!.lng, 750, queryFilters),
    enabled: Boolean(drilldownCenter),
  });

  const incidentPoints = useMemo(
    () => (data?.points ?? []).flatMap((point) => {
      const position = getDensityPointLatLng(point);
      return position ? [{ point, position }] : [];
    }),
    [data],
  );
  const heatPoints = useMemo(
    () => incidentPoints.flatMap(({ point }) => {
      const heatPoint = toDensityHeatPoint(point);
      return heatPoint ? [heatPoint] : [];
    }),
    [incidentPoints],
  );
  const layers = densityLayerVisibility(mapMode);
  const summary = data?.summary;
  const categoryOptions = useMemo(
    () => Array.from(new Set([...CATEGORY_OPTIONS, ...(data?.points ?? []).map((point) => point.category)])).sort(),
    [data],
  );
  const severityRows = [...SEVERITY_ORDER, 'unavailable'].filter(
    (severity) => (summary?.bySeverity[severity] ?? 0) > 0,
  );
  const categoryRows = Object.entries(summary?.byCategory ?? {}).sort(([left], [right]) => left.localeCompare(right));
  const setFilter = (key: string, value: string) => setFilters((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Flame className="h-6 w-6 text-orange-500" />Mật độ sự cố</h1>
        <p className="mt-1 text-sm text-muted-foreground">Mật độ hoạt động của các sự cố thực tế được báo cáo. Cường độ màu thể hiện sự tập trung của sự cố, không phải nhiệt độ hay dự báo.</p>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-5">
          <label className="text-xs font-medium text-muted-foreground">Danh mục
            <select className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm text-foreground" value={filters.category} onChange={(event) => setFilter('category', event.target.value)}>
              <option value="all">Tất cả danh mục</option>{categoryOptions.map((value) => <option key={value} value={value}>{formatMapLabel(value)}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">Mức độ
            <select className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm text-foreground" value={filters.severity} onChange={(event) => setFilter('severity', event.target.value)}>
              <option value="all">Tất cả mức độ</option><option value="critical">Nghiêm trọng</option><option value="high">Cao</option><option value="medium">Trung bình</option><option value="low">Thấp</option>
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">Trạng thái
            <select className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm text-foreground" value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
              <option value="all">Tất cả trạng thái</option><option value="active">Đang xử lý</option><option value="resolved">Đã giải quyết</option><option value="closed">Đã đóng</option>
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">Từ ngày
            <input className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm text-foreground" type="date" value={filters.from} onChange={(event) => setFilter('from', event.target.value)} />
          </label>
          <label className="text-xs font-medium text-muted-foreground">Đến ngày
            <input className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm text-foreground" type="date" value={filters.to} onChange={(event) => setFilter('to', event.target.value)} />
          </label>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        <section className="ecoalert-incident-density-map relative isolate z-0 min-h-[600px] overflow-hidden rounded-xl border bg-muted">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-background/95 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('incident_density.mode_label')}</p>
            <div className="flex rounded-md border p-0.5" aria-label={t('incident_density.mode_label')}>
              {([
                ['heatmap', 'incident_density.mode_heatmap'],
                ['incidents', 'incident_density.mode_incidents'],
                ['combined', 'incident_density.mode_combined'],
              ] as const).map(([mode, label]) => (
                <Button
                  key={mode}
                  size="sm"
                  variant={mapMode === mode ? 'secondary' : 'ghost'}
                  className="h-8 px-2.5 text-xs"
                  onClick={() => setMapMode(mode)}
                >
                  {t(label)}
                </Button>
              ))}
            </div>
          </div>
          <MapContainer center={DEFAULT_CENTER} zoom={12} className="h-[550px] w-full">
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <DensityClickHandler onSelect={setDrilldownCenter} />
            {layers.heatmap && heatPoints.length > 0 ? <HeatmapLayer points={heatPoints} /> : null}
            {layers.incidents ? (
              <Pane name="incident-density-markers" style={{ zIndex: 650 }}>
                {incidentPoints.map(({ point, position }) => {
                  const severity = normalizeSeverity(point.severity);
                  const isSelected = selectedIncidentId === point.incidentId;
                  return (
                    <CircleMarker
                      key={point.incidentId}
                      center={position}
                      radius={isSelected ? 10 : 7}
                      pathOptions={{
                        color: isSelected ? '#0F172A' : '#FFFFFF',
                        fillColor: severity ? SEVERITY_COLORS[severity] : UNKNOWN_SEVERITY_COLOR,
                        fillOpacity: 0.96,
                        weight: isSelected ? 3 : 2,
                      }}
                      eventHandlers={{
                        click: (event) => {
                          L.DomEvent.stopPropagation(event.originalEvent);
                          setSelectedIncidentId(point.incidentId);
                        },
                      }}
                    >
                      <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
                        <p className="font-medium">{incidentReportCode(point.incidentId)}</p>
                        <p>{point.title || 'Sự cố chưa có tiêu đề'}</p>
                      </Tooltip>
                      <Popup minWidth={250}>
                        <div className="space-y-2 text-sm">
                          <div>
                            <p className="font-semibold">{incidentReportCode(point.incidentId)}</p>
                            <p className="font-medium">{point.title || 'Sự cố chưa có tiêu đề'}</p>
                          </div>
                          <PopupField label="Danh mục" value={formatMapLabel(point.category)} />
                          <PopupField label="Mức độ" value={severity ? formatMapLabel(severity) : 'Không có'} />
                          <PopupField label="Trạng thái" value={formatMapLabel(point.status)} />
                          <PopupField label="Thời gian báo cáo" value={formatReportedAt(point.createdAt, language)} />
                          <PopupField label="Địa chỉ" value={point.address || 'Không có địa chỉ'} />
                          <Button asChild size="sm" className="mt-1 w-full">
                            <Link to={'/admin/reports/' + point.incidentId}>Xem sự cố</Link>
                          </Button>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </Pane>
            ) : null}
          </MapContainer>
          {isLoading ? <div className="absolute inset-x-0 bottom-0 top-[49px] z-10 flex items-center justify-center bg-background/65"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : null}
          {isError ? <div className="absolute left-4 top-16 z-10 rounded-md border border-destructive/40 bg-background p-3 text-sm text-destructive">Không thể tải dữ liệu mật độ sự cố.</div> : null}
          {!isLoading && !isError && incidentPoints.length === 0 ? <div className="absolute left-1/2 top-16 z-10 -translate-x-1/2 rounded-md border bg-background p-3 text-sm shadow">Không có sự cố nào khớp với bộ lọc này.</div> : null}
          <div className="pointer-events-none absolute bottom-4 left-4 z-10 max-w-xs rounded-lg border bg-background/95 p-3 text-xs shadow">
            <div className="mb-1 flex items-center gap-1.5 font-semibold"><Info className="h-4 w-4 text-orange-500" />Nhấn vào một vị trí để xem chi tiết sự cố</div>
            <p className="text-muted-foreground">Mật độ được tính toán từ vị trí các cảnh báo GIS và không phải là lớp dữ liệu thời tiết hay nhiệt độ.</p>
          </div>
        </section>

        <Card>
          <CardHeader><CardTitle>Tóm tắt hoạt động</CardTitle><CardDescription>Bản ghi cảnh báo GIS thực tế trong giao diện đã chọn.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Metric label="Tổng số" value={summary?.total ?? 0} /><Metric label="Đang mở" value={summary?.open ?? 0} /><Metric label="Đã giải quyết" value={summary?.resolved ?? 0} /><Metric label="Đã đóng" value={summary?.closed ?? 0} />
            </div>
            <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Theo mức độ</p><div className="space-y-2">{severityRows.map((severity) => <div key={severity} className="flex justify-between text-sm"><Badge variant="outline">{formatMapLabel(severity)}</Badge><strong>{summary?.bySeverity[severity] ?? 0}</strong></div>)}</div></div>
            <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Theo danh mục</p><div className="max-h-48 space-y-2 overflow-auto">{categoryRows.map(([category, count]) => <div key={category} className="flex justify-between gap-3 text-sm"><span>{formatMapLabel(category)}</span><strong>{count}</strong></div>)}</div></div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(drilldownCenter)} onOpenChange={(open) => !open && setDrilldownCenter(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chi tiết sự cố khu vực</DialogTitle>
            <DialogDescription>Các sự cố được báo cáo trong bán kính 750 mét từ vị trí bạn chọn.</DialogDescription>
          </DialogHeader>
          {drilldown.isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <Metric label="Tổng số" value={drilldown.data?.summary.total ?? 0} />
                <Metric label="Đang mở" value={drilldown.data?.summary.open ?? 0} />
                <Metric label="Nghiêm trọng" value={drilldown.data?.summary.bySeverity.critical ?? 0} />
                <Metric label="Cao" value={drilldown.data?.summary.bySeverity.high ?? 0} />
              </div>
              <div className="max-h-[45vh] space-y-3 overflow-auto">
                {(drilldown.data?.incidents ?? []).map((incident) => {
                  const severity = normalizeSeverity(incident.severity);
                  return (
                    <div key={incident.alertId} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{incident.title || 'Sự cố chưa có tiêu đề'}</p>
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{incident.address || 'Không có địa chỉ'} · {Math.round(incident.distanceMeters)} m</p>
                        </div>
                        <div className="flex gap-1"><Badge variant="outline">{severity ? formatMapLabel(severity) : 'Không có'}</Badge><Badge>{formatMapLabel(incident.status)}</Badge></div>
                      </div>
                      <Button asChild size="sm" variant="outline" className="mt-3"><Link to={'/admin/reports/' + incident.alertId}>Xem sự cố</Link></Button>
                    </div>
                  );
                })}
                {!drilldown.data?.incidents.length ? <p className="py-8 text-center text-sm text-muted-foreground">Không tìm thấy sự cố nào xung quanh điểm này.</p> : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PopupField({ label, value }: { label: string; value: string }) {
  return <p><span className="font-medium">{label}:</span> {value}</p>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p></div>;
}
