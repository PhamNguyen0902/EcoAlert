import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  MapPin,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useAlert } from '@/hooks/hooks';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EvidenceGallery } from '@/components/incidents/EvidenceGallery';
import {
  formatIncidentCategory,
  getStatusDescription,
  IncidentStatusProgress,
  normalizeIncidentStatus,
  SeverityBadge,
  StatusBadge,
} from '@/components/incidents/incident-status';
import { IncidentTimeline } from '@/components/incidents/IncidentTimeline';
import { VisionAnalysisCard } from '@/components/incidents/VisionAnalysisCard';
import { OverallAiAnalysisCard } from '@/components/incidents/OverallAiAnalysisCard';
import { IncidentLocationDetails } from '@/components/location/IncidentLocationDetails';
import { hasValidCoordinates } from '@/lib/maps';
import { getAlertDisplayConfidence, getAlertDisplaySeverity } from '@/lib/ai-confidence';
import 'leaflet/dist/leaflet.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

const formatDate = (value?: string, dateFormat = 'PPp') => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : format(date, dateFormat);
};

export default function AlertDetail() {
  const { t } = useLanguage();
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: alert, isLoading, isError } = useAlert(id);

  if (isLoading) {
    return <div className="flex min-h-80 items-center justify-center" role="status"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="sr-only">Loading incident report</span></div>;
  }

  if (isError || !alert) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center rounded-xl border border-destructive/30 bg-card px-6 py-12 text-center shadow-sm">
        <AlertCircle className="h-9 w-9 text-destructive" aria-hidden="true" />
        <h1 className="mt-4 text-lg font-semibold">{t('report_not_found')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Báo cáo này có thể không còn khả dụng hoặc bạn không có quyền xem.</p>
        <Button className="mt-6" variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" />Quay lại</Button>
      </div>
    );
  }

  const [longitude = Number.NaN, latitude = Number.NaN] = alert.location?.coordinates ?? [];
  const hasCoordinates = hasValidCoordinates(latitude, longitude);
  const status = normalizeIncidentStatus(alert.status);
  const originalEvidence = alert.mediaUrls ?? [];
  const resolutionEvidence = (alert.resolutionEvidence ?? []).map((item) => item.url).filter(Boolean);
  const hasTreatmentResult = Boolean(alert.resolutionSummary || alert.treatmentMethod || alert.resolutionNotes || resolutionEvidence.length);
  const displayConfidence = getAlertDisplayConfidence(alert);
  const confidence = displayConfidence.value;
  const displaySeverity = getAlertDisplaySeverity(alert);
  const shortId = alert._id.slice(-8).toUpperCase();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-10">
      <header className="border-b pb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} aria-label="Quay lại danh sách"><ArrowLeft className="mr-2 h-4 w-4" />Quay lại</Button>
        <div className="mt-4 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary">Mã báo cáo #{shortId}</p>
            <h1 className="mt-1 break-words text-2xl font-bold tracking-tight sm:text-3xl">{alert.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span>{formatIncidentCategory(alert.category)}</span>
              <span aria-hidden="true">·</span>
              <span>Thời gian gửi: {formatDate(alert.createdAt, 'PPp')}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <StatusBadge status={status} />
            <SeverityBadge severity={displaySeverity} />
          </div>
        </div>
      </header>

      <IncidentStatusProgress status={status} />

      <main className="grid gap-6 lg:grid-cols-[minmax(0,2.2fr)_minmax(300px,0.8fr)]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="incident-details-heading">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><ClipboardList className="h-4 w-4" aria-hidden="true" /></span>
              <div>
                <h2 id="incident-details-heading" className="text-lg font-semibold">Chi tiết sự cố</h2>
                <p className="text-sm text-muted-foreground">Thông tin được cung cấp cùng báo cáo gốc.</p>
              </div>
            </div>
            <div className="mt-5 border-y py-5">
              <dl className="grid gap-5 sm:grid-cols-3">
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Danh mục</dt><dd className="mt-1.5 text-sm font-medium">{formatIncidentCategory(alert.category)}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Thời gian gửi</dt><dd className="mt-1.5 text-sm font-medium">{formatDate(alert.createdAt, 'PPp')}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trạng thái hiện tại</dt><dd className="mt-1.5"><StatusBadge status={status} /></dd></div>
              </dl>
              <div className="mt-6 border-t pt-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-primary" aria-hidden="true" />Mô tả sự cố</h3>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground">{alert.description || 'Chưa cung cấp mô tả.'}</p>
              </div>
            </div>
          </section>

          <EvidenceGallery
            title="Hình ảnh minh chứng"
            description="Hình ảnh gốc gửi cùng báo cáo sự cố."
            images={originalEvidence}
            emptyMessage={t('alert_detail.no_media')}
            altPrefix="Hình ảnh minh chứng"
          />

          <section className="border-t pt-8" aria-labelledby="ai-analysis-heading">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bot className="h-4 w-4" aria-hidden="true" /></span>
              <div>
                <h2 id="ai-analysis-heading" className="text-lg font-semibold">{t('alert_detail.ai_analysis')}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t('alert_detail.ai_read_only')}</p>
              </div>
            </div>

            <dl className="mt-5 grid gap-4 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('alert_detail.detected_category')}</dt>
                <dd className="mt-1.5 break-words font-medium">{formatIncidentCategory(alert.category)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('alert_detail.confidence')} · {displayConfidence.source === 'FUSION' ? 'Fusion' : displayConfidence.source === 'SEMANTIC' ? t('alert_detail.confidence_semantic') : t('alert_detail.confidence_category')}</dt>
                <dd className="mt-1.5 font-medium tabular-nums">{confidence !== null ? `${Math.round(confidence * 100)}%` : t('alert_detail.confidence_unavailable')}</dd>
                {confidence !== null ? <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={t('alert_detail.ai_confidence_aria')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(confidence * 100)}><div className="h-full bg-primary transition-[width]" style={{ width: `${confidence * 100}%` }} /></div> : null}
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('alert_detail.suggested_severity')}</dt>
                <dd className="mt-1.5"><SeverityBadge severity={displaySeverity} /></dd>
              </div>
            </dl>

            <p className="mt-4 rounded-lg border bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">{t('alert_detail.ai_disclaimer')}</p>

            <div className="mt-5 space-y-5">
              <OverallAiAnalysisCard alert={alert} />
              <VisionAnalysisCard alert={alert} />
            </div>
          </section>

          {hasTreatmentResult ? (
            <section className="border-t pt-8" aria-labelledby="treatment-result-heading">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="h-4 w-4" aria-hidden="true" /></span>
                <div>
                  <h2 id="treatment-result-heading" className="text-lg font-semibold">Kết quả xử lý của Cán bộ</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Hồ sơ xử lý được lưu trữ độc lập với bằng chứng ban đầu của người dân.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-5 border-y py-5 sm:grid-cols-2">
                <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tóm tắt kết quả</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{alert.resolutionSummary || 'Chưa cung cấp'}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phương pháp xử lý</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{alert.treatmentMethod || 'Chưa cung cấp'}</p></div>
                {alert.materialsUsed ? <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vật tư & Thiết bị</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{alert.materialsUsed}</p></div> : null}
                {alert.resolutionNotes ? <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ghi chú bổ sung</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{alert.resolutionNotes}</p></div> : null}
              </div>
              <div className="mt-6">
                <EvidenceGallery title="Hình ảnh sau xử lý" images={resolutionEvidence} emptyMessage="Chưa có hình ảnh sau xử lý." altPrefix="Hình ảnh sau xử lý" />
              </div>
            </section>
          ) : null}

        </div>

        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="p-5">
                <IncidentLocationDetails address={alert.address} latitude={latitude} longitude={longitude} />
              </div>
              {hasCoordinates ? (
                <div className="h-64 border-t bg-muted">
                  <MapContainer center={[latitude, longitude]} zoom={15} scrollWheelZoom={false} className="h-full w-full" aria-label="Bản đồ vị trí sự cố">
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[latitude, longitude]} />
                  </MapContainer>
                </div>
              ) : (
                <div className="flex min-h-36 flex-col items-center justify-center border-t px-5 text-center text-sm text-muted-foreground">
                  <MapPin className="h-5 w-5" aria-hidden="true" />
                  <p className="mt-2">Không thể hiển thị bản đồ vì báo cáo chưa có tọa độ GPS xác thực.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-primary" aria-hidden="true" /><h2 className="font-semibold">Tóm tắt tiến độ</h2></div>
              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Phân công</dt><dd className="text-right font-medium">{alert.assignedOfficerId ? 'Đã phân công cán bộ' : 'Đang chờ phân công'}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Bắt đầu xử lý</dt><dd className="text-right">{formatDate(alert.startedAt)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Đã đến hiện trường</dt><dd className="text-right">{formatDate(alert.arrivedAt)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Hoàn thành xử lý</dt><dd className="text-right">{formatDate(alert.resolvedAt)}</dd></div>
              </dl>
              <div className="mt-5 rounded-lg bg-primary/5 p-3 text-xs leading-5 text-muted-foreground"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-primary" aria-hidden="true" />{getStatusDescription(status)}</div>
            </CardContent>
          </Card>
        </aside>

        <section className="min-w-0 border-t pt-8 lg:col-start-1" aria-label={t('alert_detail.timeline')}>
          <IncidentTimeline entries={alert.timeline} createdAt={alert.createdAt} citizenId={alert.citizenId} analysisMode={alert.aiAnalysisMode} vision={alert.aiVision} />
        </section>
      </main>
    </div>
  );
}
