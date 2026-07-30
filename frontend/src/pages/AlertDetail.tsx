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
import { IncidentLocationDetails } from '@/components/location/IncidentLocationDetails';
import { hasValidCoordinates } from '@/lib/maps';
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
        <p className="mt-2 text-sm text-muted-foreground">The report may no longer be available, or you may not have access to it.</p>
        <Button className="mt-6" variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" />{t('btn.back')}</Button>
      </div>
    );
  }

  const [longitude = Number.NaN, latitude = Number.NaN] = alert.location?.coordinates ?? [];
  const hasCoordinates = hasValidCoordinates(latitude, longitude);
  const status = normalizeIncidentStatus(alert.status);
  const originalEvidence = alert.mediaUrls ?? [];
  const resolutionEvidence = (alert.resolutionEvidence ?? []).map((item) => item.url).filter(Boolean);
  const hasTreatmentResult = Boolean(alert.resolutionSummary || alert.treatmentMethod || alert.resolutionNotes || resolutionEvidence.length);
  const hasAiConfidence = alert.aiConfidence !== undefined && alert.aiConfidence !== null && Number.isFinite(alert.aiConfidence);
  const confidence = hasAiConfidence ? Math.max(0, Math.min(1, alert.aiConfidence ?? 0)) : null;
  const shortId = alert._id.slice(-8).toUpperCase();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-10">
      <header className="border-b pb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} aria-label="Go back to incident reports"><ArrowLeft className="mr-2 h-4 w-4" />{t('btn.back')}</Button>
        <div className="mt-4 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary">Report #{shortId}</p>
            <h1 className="mt-1 break-words text-2xl font-bold tracking-tight sm:text-3xl">{alert.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span>{formatIncidentCategory(alert.category)}</span>
              <span aria-hidden="true">·</span>
              <span>Reported {formatDate(alert.createdAt, 'PPp')}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <StatusBadge status={status} />
            <SeverityBadge severity={alert.severity} />
          </div>
        </div>
      </header>

      <IncidentStatusProgress status={status} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <main className="min-w-0 space-y-8">
          <section aria-labelledby="incident-details-heading">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><ClipboardList className="h-4 w-4" aria-hidden="true" /></span>
              <div>
                <h2 id="incident-details-heading" className="text-lg font-semibold">Incident details</h2>
                <p className="text-sm text-muted-foreground">Information submitted with the original report.</p>
              </div>
            </div>
            <div className="mt-5 border-y py-5">
              <dl className="grid gap-5 sm:grid-cols-3">
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category</dt><dd className="mt-1.5 text-sm font-medium">{formatIncidentCategory(alert.category)}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reported</dt><dd className="mt-1.5 text-sm font-medium">{formatDate(alert.createdAt, 'PPp')}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current status</dt><dd className="mt-1.5"><StatusBadge status={status} /></dd></div>
              </dl>
              <div className="mt-6 border-t pt-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-primary" aria-hidden="true" />Description</h3>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground">{alert.description || 'No description was provided.'}</p>
              </div>
            </div>
          </section>

          <EvidenceGallery
            title="Submitted evidence"
            description="Original images submitted with this report."
            images={originalEvidence}
            emptyMessage={t('alert_detail.no_media')}
            altPrefix="Submitted evidence"
          />

          {hasTreatmentResult ? (
            <section className="border-t pt-8" aria-labelledby="treatment-result-heading">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="h-4 w-4" aria-hidden="true" /></span>
                <div>
                  <h2 id="treatment-result-heading" className="text-lg font-semibold">Officer treatment result</h2>
                  <p className="mt-1 text-sm text-muted-foreground">This read-only record is kept separate from the original citizen evidence.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-5 border-y py-5 sm:grid-cols-2">
                <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resolution summary</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{alert.resolutionSummary || 'Not provided'}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Treatment method</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{alert.treatmentMethod || 'Not provided'}</p></div>
                {alert.materialsUsed ? <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Materials or equipment</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{alert.materialsUsed}</p></div> : null}
                {alert.resolutionNotes ? <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Additional notes</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{alert.resolutionNotes}</p></div> : null}
              </div>
              <div className="mt-6">
                <EvidenceGallery title="After-treatment evidence" images={resolutionEvidence} emptyMessage="No after-treatment images have been added." altPrefix="After-treatment evidence" />
              </div>
            </section>
          ) : null}

          <div className="border-t pt-8">
            <IncidentTimeline entries={alert.timeline} createdAt={alert.createdAt} citizenId={alert.citizenId} />
          </div>
        </main>

        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="p-5">
                <IncidentLocationDetails address={alert.address} latitude={latitude} longitude={longitude} />
              </div>
              {hasCoordinates ? (
                <div className="h-64 border-t bg-muted">
                  <MapContainer center={[latitude, longitude]} zoom={15} scrollWheelZoom={false} className="h-full w-full" aria-label="Incident location map">
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[latitude, longitude]} />
                  </MapContainer>
                </div>
              ) : (
                <div className="flex min-h-36 flex-col items-center justify-center border-t px-5 text-center text-sm text-muted-foreground">
                  <MapPin className="h-5 w-5" aria-hidden="true" />
                  <p className="mt-2">Map unavailable because this report has no confirmed coordinates.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2"><Bot className="h-4 w-4 text-primary" aria-hidden="true" /><h2 className="font-semibold">{t('alert_detail.ai_analysis')}</h2></div>
              <div className="mt-5 space-y-4 text-sm">
                <div className="flex items-start justify-between gap-4"><span className="text-muted-foreground">{t('alert_detail.detected_category')}</span><span className="text-right font-medium">{formatIncidentCategory(alert.category)}</span></div>
                <div className="flex items-start justify-between gap-4"><span className="text-muted-foreground">Suggested severity</span><SeverityBadge severity={alert.aiSuggestedPriority ?? alert.severity} /></div>
                {confidence !== null ? (
                  <div>
                    <div className="flex justify-between gap-4"><span className="text-muted-foreground">{t('alert_detail.confidence')}</span><span className="font-medium tabular-nums">{Math.round(confidence * 100)}%</span></div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="AI confidence" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(confidence * 100)}><div className="h-full bg-primary transition-[width]" style={{ width: `${confidence * 100}%` }} /></div>
                  </div>
                ) : <p className="text-sm text-muted-foreground">Analysis confidence is not available.</p>}
                <p className="rounded-lg border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">AI analysis supports triage and may be reviewed by an officer. It is not a final determination.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-primary" aria-hidden="true" /><h2 className="font-semibold">Handling summary</h2></div>
              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Assignment</dt><dd className="text-right font-medium">{alert.assignedOfficerId ? 'Officer assigned' : 'Awaiting assignment'}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Started</dt><dd className="text-right">{formatDate(alert.startedAt)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Arrival</dt><dd className="text-right">{formatDate(alert.arrivedAt)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Resolution</dt><dd className="text-right">{formatDate(alert.resolvedAt)}</dd></div>
              </dl>
              <div className="mt-5 rounded-lg bg-primary/5 p-3 text-xs leading-5 text-muted-foreground"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-primary" aria-hidden="true" />{getStatusDescription(status)}</div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
