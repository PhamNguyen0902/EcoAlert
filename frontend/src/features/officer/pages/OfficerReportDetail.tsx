import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Link, useParams } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  Clock,
  Image as ImageIcon,
  Loader2,
  MapPin,
  PlayCircle,
  Save,
  ShieldCheck,
  StickyNote,
  Trash2,
  Upload,
  UserCheck,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  useAddOfficerNote,
  useAlert,
  useAssignOfficer,
  useCloseIncident,
  useConfirmArrival,
  useResolveIncident,
  useStartHandling,
  useUsers,
} from '@/hooks/hooks';
import { alertService } from '@/services/services';
import { useAuth } from '@/contexts/AuthContext';
import { getApiErrorMessage } from '@/lib/api-error';
import { hasValidCoordinates } from '@/lib/maps';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { IncidentLocationDetails } from '@/components/location/IncidentLocationDetails';
import { ConfirmActionDialog } from '@/components/incidents/ConfirmActionDialog';
import { IncidentTimeline } from '@/components/incidents/IncidentTimeline';
import type { ResolutionInput } from '@/types';
import 'leaflet/dist/leaflet.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

const MAX_EVIDENCE_SIZE = 10 * 1024 * 1024;
const MAX_EVIDENCE_COUNT = 20;
const ADMIN_ASSIGNABLE_STATUSES = new Set(['pending', 'verified', 'ai_analyzing']);

type ConfirmAction = 'assign' | 'start' | 'arrival' | 'resolve' | 'close' | null;
type UploadState = 'ready' | 'uploading' | 'uploaded' | 'failed';

interface EvidenceDraft {
  id: string;
  file: File;
  previewUrl: string;
  state: UploadState;
  progress: number;
  uploadedUrl?: string;
  error?: string;
}

const formatTimestamp = (value?: string) => value ? format(new Date(value), 'PPp') : 'Not completed';

export default function OfficerReportDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const { data: alert, isLoading, isError, error } = useAlert(id);
  const { data: officerData } = useUsers(1, 100, 'OFFICER', undefined, role === 'ADMIN');
  const assignOfficer = useAssignOfficer();
  const startHandling = useStartHandling();
  const confirmArrival = useConfirmArrival();
  const resolveIncident = useResolveIncident();
  const closeIncident = useCloseIncident();
  const addOfficerNote = useAddOfficerNote();

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [selectedOfficerId, setSelectedOfficerId] = useState('');
  const [noteText, setNoteText] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [treatmentMethod, setTreatmentMethod] = useState('');
  const [materialsUsed, setMaterialsUsed] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [evidenceDrafts, setEvidenceDrafts] = useState<EvidenceDraft[]>([]);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const evidenceRef = useRef<EvidenceDraft[]>([]);

  useEffect(() => {
    evidenceRef.current = evidenceDrafts;
  }, [evidenceDrafts]);

  useEffect(() => () => {
    evidenceRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  }, []);

  if (isLoading) {
    return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (isError || !alert) {
    return (
      <Card className="mx-auto max-w-lg border-destructive/40">
        <CardContent className="space-y-4 py-12 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
          <p className="font-medium">Report not found or you do not have access.</p>
          <p className="text-sm text-muted-foreground">{getApiErrorMessage(error, 'Unable to load this report.')}</p>
          <Button asChild variant="outline"><Link to={role === 'ADMIN' ? '/admin/reports' : '/officer/assigned'}>Back to Reports</Link></Button>
        </CardContent>
      </Card>
    );
  }

  const [longitude = Number.NaN, latitude = Number.NaN] = alert.location?.coordinates ?? [];
  const hasCoordinates = hasValidCoordinates(latitude, longitude);
  const isOfficer = role === 'OFFICER';
  const isAdmin = role === 'ADMIN';
  const normalizedAlertStatus = alert.status.toLowerCase();
  const canAdminAssign = isAdmin && ADMIN_ASSIGNABLE_STATUSES.has(normalizedAlertStatus);
  const isAssignedToCurrentOfficer = isOfficer && alert.assignedOfficerId === user?._id;
  const officers = officerData?.items ?? [];
  const assignedOfficer = officers.find((officer) => officer._id === alert.assignedOfficerId);
  const assignedOfficerLabel = alert.assignedOfficerId
    ? assignedOfficer?.fullName || (alert.assignedOfficerId === user?._id ? user.fullName : alert.assignedOfficerId)
    : 'Not assigned';
  const originalEvidence = alert.mediaUrls ?? [];
  const resolutionEvidence = alert.resolutionEvidence ?? [];
  const statusHistory = alert.statusHistory ?? [];
  const canEditOfficerNote = isAdmin || isAssignedToCurrentOfficer;
  const resolutionFieldsValid = Boolean(resolutionSummary.trim() && treatmentMethod.trim() && evidenceDrafts.length > 0);

  const onWorkflowError = (workflowError: unknown, fallback: string) => {
    toast.error(getApiErrorMessage(workflowError, fallback));
    setConfirmAction(null);
  };

  const handleAssign = () => {
    if (!selectedOfficerId) return;
    assignOfficer.mutate(
      { id, officerId: selectedOfficerId },
      {
        onSuccess: () => {
          toast.success('Officer assigned successfully.');
          setConfirmAction(null);
        },
        onError: (mutationError) => onWorkflowError(mutationError, 'Unable to assign this incident.'),
      },
    );
  };

  const handleStart = () => {
    startHandling.mutate(id, {
      onSuccess: () => {
        toast.success('Incident handling started.');
        setConfirmAction(null);
      },
      onError: (mutationError) => onWorkflowError(mutationError, 'Unable to start handling.'),
    });
  };

  const handleArrival = () => {
    confirmArrival.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success('Arrival confirmed.');
          setConfirmAction(null);
        },
        onError: (mutationError) => onWorkflowError(mutationError, 'Unable to confirm arrival.'),
      },
    );
  };

  const addEvidenceFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const availableSlots = MAX_EVIDENCE_COUNT - evidenceDrafts.length;
    const accepted: EvidenceDraft[] = [];
    Array.from(fileList).slice(0, Math.max(0, availableSlots)).forEach((file, index) => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image.`);
        return;
      }
      if (file.size > MAX_EVIDENCE_SIZE) {
        toast.error(`${file.name} exceeds the 10 MB upload limit.`);
        return;
      }
      accepted.push({
        id: globalThis.crypto?.randomUUID?.() || `${file.name}-${Date.now()}-${index}`,
        file,
        previewUrl: URL.createObjectURL(file),
        state: 'ready',
        progress: 0,
      });
    });
    if (fileList.length > availableSlots) toast.error(`A maximum of ${MAX_EVIDENCE_COUNT} images is allowed.`);
    setEvidenceDrafts((current) => [...current, ...accepted]);
  };

  const removeEvidence = (draftId: string) => {
    setEvidenceDrafts((current) => {
      const removed = current.find((item) => item.id === draftId);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((item) => item.id !== draftId);
    });
  };

  const uploadEvidenceAndConfirm = async () => {
    if (!resolutionSummary.trim() || !treatmentMethod.trim()) {
      toast.error('Resolution summary and treatment method are required.');
      return;
    }
    if (evidenceDrafts.length === 0) {
      toast.error('Add at least one after-treatment image.');
      return;
    }

    setIsUploadingEvidence(true);
    const uploadedDrafts = await Promise.all(evidenceDrafts.map(async (draft) => {
      if (draft.uploadedUrl) return draft;
      setEvidenceDrafts((current) => current.map((item) =>
        item.id === draft.id ? { ...item, state: 'uploading', progress: 0, error: undefined } : item,
      ));
      try {
        const uploadedUrl = await alertService.uploadMedia(draft.file, (progress) => {
          setEvidenceDrafts((current) => current.map((item) =>
            item.id === draft.id ? { ...item, progress } : item,
          ));
        });
        return { ...draft, uploadedUrl, state: 'uploaded' as const, progress: 100, error: undefined };
      } catch (uploadError) {
        return {
          ...draft,
          state: 'failed' as const,
          progress: 0,
          error: getApiErrorMessage(uploadError, 'Upload failed'),
        };
      }
    }));
    setEvidenceDrafts(uploadedDrafts);
    setIsUploadingEvidence(false);

    const failures = uploadedDrafts.filter((draft) => !draft.uploadedUrl);
    if (failures.length > 0) {
      toast.error(`${failures.length} image${failures.length === 1 ? '' : 's'} failed to upload. Successful uploads were kept; retry to upload only the failed files.`);
      return;
    }
    setConfirmAction('resolve');
  };

  const handleResolve = () => {
    const evidence = evidenceDrafts.flatMap((draft) => draft.uploadedUrl ? [{ url: draft.uploadedUrl }] : []);
    const data: ResolutionInput = {
      resolutionSummary: resolutionSummary.trim(),
      treatmentMethod: treatmentMethod.trim(),
      materialsUsed: materialsUsed.trim() || undefined,
      additionalNotes: additionalNotes.trim() || undefined,
      evidence,
    };
    resolveIncident.mutate(
      { id, data },
      {
        onSuccess: () => {
          toast.success('Incident marked as resolved.');
          setConfirmAction(null);
        },
        onError: (mutationError) => onWorkflowError(mutationError, 'Unable to resolve this incident.'),
      },
    );
  };

  const handleClose = () => {
    closeIncident.mutate(
      { id, reviewNote: reviewNote.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Incident closed successfully.');
          setConfirmAction(null);
        },
        onError: (mutationError) => onWorkflowError(mutationError, 'Unable to close this incident.'),
      },
    );
  };

  const handleSaveNote = () => {
    if (!noteText.trim()) return;
    addOfficerNote.mutate(
      { id, note: noteText.trim() },
      {
        onSuccess: () => {
          toast.success('Officer note saved.');
          setEditingNote(false);
        },
        onError: (mutationError) => toast.error(getApiErrorMessage(mutationError, 'Unable to save note.')),
      },
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <Button asChild variant="ghost" className="w-fit">
          <Link to={isAdmin ? '/admin/reports' : '/officer/assigned'}><ChevronLeft className="mr-2 h-4 w-4" />Back to Reports</Link>
        </Button>
        <div className="flex gap-2">
          <Badge variant="outline" className="capitalize">{alert.severity}</Badge>
          <Badge className="capitalize">{alert.status.replace(/_/g, ' ')}</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-2xl">{alert.title}</CardTitle>
                  <CardDescription className="mt-2 capitalize">{alert.category.replace(/_/g, ' ')}</CardDescription>
                </div>
                <Badge variant="outline" className="capitalize">{alert.severity} priority</Badge>
              </div>
              <div className="flex flex-wrap gap-4 pt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{format(new Date(alert.createdAt), 'PP')}</span>
                <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{format(new Date(alert.createdAt), 'p')}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="whitespace-pre-wrap leading-relaxed">{alert.description}</p>
              <div>
                <h3 className="mb-3 flex items-center gap-2 font-semibold"><ImageIcon className="h-4 w-4" />Citizen Evidence ({originalEvidence.length})</h3>
                {originalEvidence.length ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {originalEvidence.map((url, index) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="aspect-video overflow-hidden rounded-lg border bg-muted">
                        <img src={url} alt={`Citizen evidence ${index + 1}`} className="h-full w-full object-cover transition hover:scale-105" />
                      </a>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">No citizen image was submitted.</p>}
              </div>
            </CardContent>
          </Card>

          {(alert.resolutionSummary || resolutionEvidence.length > 0) ? (
            <Card className="border-emerald-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5 text-emerald-600" />Resolution Details</CardTitle>
                <CardDescription>Officer-submitted treatment record, kept separate from citizen evidence.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><p className="text-xs font-semibold uppercase text-muted-foreground">Resolution summary</p><p className="mt-1 whitespace-pre-wrap text-sm">{alert.resolutionSummary || 'Not provided'}</p></div>
                  <div><p className="text-xs font-semibold uppercase text-muted-foreground">Treatment method</p><p className="mt-1 whitespace-pre-wrap text-sm">{alert.treatmentMethod || 'Not provided'}</p></div>
                  {alert.materialsUsed ? <div><p className="text-xs font-semibold uppercase text-muted-foreground">Materials / equipment</p><p className="mt-1 whitespace-pre-wrap text-sm">{alert.materialsUsed}</p></div> : null}
                  {alert.resolutionNotes ? <div><p className="text-xs font-semibold uppercase text-muted-foreground">Additional notes</p><p className="mt-1 whitespace-pre-wrap text-sm">{alert.resolutionNotes}</p></div> : null}
                </div>
                <div>
                  <p className="mb-3 text-sm font-semibold">After-treatment evidence ({resolutionEvidence.length})</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {resolutionEvidence.map((item, index) => (
                      <a key={item._id || item.url} href={item.url} target="_blank" rel="noopener noreferrer" className="aspect-video overflow-hidden rounded-lg border bg-muted">
                        <img src={item.url} alt={`After-treatment evidence ${index + 1}`} className="h-full w-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
                {alert.adminReviewNote ? <div className="rounded-lg border bg-muted/40 p-3"><p className="text-xs font-semibold uppercase text-muted-foreground">Admin review note</p><p className="mt-1 text-sm">{alert.adminReviewNote}</p></div> : null}
              </CardContent>
            </Card>
          ) : null}

          <IncidentTimeline entries={alert.timeline} createdAt={alert.createdAt} citizenId={alert.citizenId} />

          <Card>
            <CardHeader><CardTitle className="text-lg">Status History</CardTitle><CardDescription>Append-only workflow transitions recorded by the server.</CardDescription></CardHeader>
            <CardContent>
              {statusHistory.length ? (
                <div className="space-y-3">
                  {[...statusHistory].sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()).map((entry, index) => (
                    <div key={entry._id || `${entry.changedAt}-${index}`} className="flex flex-col justify-between gap-2 rounded-lg border p-3 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="capitalize">{entry.fromStatus?.replace(/_/g, ' ') || 'created'}</Badge>
                        <span>→</span>
                        <Badge className="capitalize">{entry.toStatus.replace(/_/g, ' ')}</Badge>
                        <span className="text-muted-foreground">by {entry.changedByRole.toLowerCase()}</span>
                      </div>
                      <time className="text-xs text-muted-foreground">{formatTimestamp(entry.changedAt)}</time>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">This legacy incident has no recorded status history.</p>}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><UserCheck className="h-5 w-5" />Officer Assignment</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Assigned officer</span><span className="text-right font-medium">{assignedOfficerLabel}</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Assigned date</span><span className="text-right">{formatTimestamp(alert.assignedAt)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Workflow</span><Badge className="capitalize">{alert.status.replace(/_/g, ' ')}</Badge></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Started</span><span className="text-right">{formatTimestamp(alert.startedAt)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Arrival</span><span className="text-right">{formatTimestamp(alert.arrivedAt)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Resolved</span><span className="text-right">{formatTimestamp(alert.resolvedAt)}</span></div>
              {alert.arrivedAt ? <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 p-3 text-emerald-700 dark:text-emerald-300"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span>Officer has arrived at the scene.</span></div> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">{isAdmin ? 'Admin Review' : 'Officer Action'}</CardTitle><CardDescription>The next valid workflow action is shown here.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {canAdminAssign ? (
                <div className="space-y-3">
                  <label htmlFor="assigned-officer" className="text-sm font-medium">Assign to Officer</label>
                  <select id="assigned-officer" value={selectedOfficerId} onChange={(event) => setSelectedOfficerId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Select an Officer</option>
                    {officers.map((officer) => <option key={officer._id} value={officer._id}>{officer.fullName} · {officer.email}</option>)}
                  </select>
                  <Button className="w-full" disabled={!selectedOfficerId} onClick={() => setConfirmAction('assign')}><UserCheck className="mr-2 h-4 w-4" />Assign Incident</Button>
                </div>
              ) : null}

              {isAssignedToCurrentOfficer && alert.status === 'assigned' ? (
                <Button className="w-full" onClick={() => setConfirmAction('start')}><PlayCircle className="mr-2 h-4 w-4" />Start Handling</Button>
              ) : null}

              {isAssignedToCurrentOfficer && alert.status === 'in_progress' && !alert.arrivedAt ? (
                <Button className="w-full" onClick={() => setConfirmAction('arrival')}><MapPin className="mr-2 h-4 w-4" />Confirm Arrival</Button>
              ) : null}

              {isAssignedToCurrentOfficer && alert.status === 'in_progress' && alert.arrivedAt ? (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm"><p className="font-medium">Resolution evidence and notes</p><p className="mt-1 text-muted-foreground">Required fields are marked with an asterisk.</p></div>
                  <div><label htmlFor="resolution-summary" className="text-sm font-medium">Resolution Summary *</label><textarea id="resolution-summary" value={resolutionSummary} onChange={(event) => setResolutionSummary(event.target.value)} maxLength={4000} className="mt-1 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="What was resolved?" /></div>
                  <div><label htmlFor="treatment-method" className="text-sm font-medium">Treatment Method *</label><textarea id="treatment-method" value={treatmentMethod} onChange={(event) => setTreatmentMethod(event.target.value)} maxLength={4000} className="mt-1 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Actions taken at the site" /></div>
                  <div><label htmlFor="materials-used" className="text-sm font-medium">Materials / Equipment</label><textarea id="materials-used" value={materialsUsed} onChange={(event) => setMaterialsUsed(event.target.value)} maxLength={2000} className="mt-1 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                  <div><label htmlFor="additional-notes" className="text-sm font-medium">Additional Notes</label><textarea id="additional-notes" value={additionalNotes} onChange={(event) => setAdditionalNotes(event.target.value)} maxLength={4000} className="mt-1 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                  <div className="space-y-3">
                    <label htmlFor="resolution-evidence" className="text-sm font-medium">After-treatment Images * ({evidenceDrafts.length}/{MAX_EVIDENCE_COUNT})</label>
                    <label htmlFor="resolution-evidence" className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed p-5 text-sm text-muted-foreground transition hover:border-primary hover:text-primary"><Upload className="mr-2 h-4 w-4" />Choose camera or image files</label>
                    <input id="resolution-evidence" type="file" accept="image/*" multiple className="sr-only" onChange={(event) => { addEvidenceFiles(event.target.files); event.target.value = ''; }} />
                    <div className="grid grid-cols-2 gap-2">
                      {evidenceDrafts.map((draft) => (
                        <div key={draft.id} className="relative overflow-hidden rounded-lg border bg-muted">
                          <img src={draft.previewUrl} alt="After-treatment preview" className="aspect-square h-full w-full object-cover" />
                          <button type="button" onClick={() => removeEvidence(draft.id)} disabled={draft.state === 'uploading'} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white disabled:opacity-50" aria-label={`Remove ${draft.file.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
                          <div className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1 text-[10px] text-white">
                            {draft.state === 'uploading' ? `Uploading ${draft.progress}%` : draft.state === 'failed' ? draft.error : draft.state === 'uploaded' ? 'Uploaded' : `${(draft.file.size / 1024 / 1024).toFixed(1)} MB`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={!resolutionFieldsValid || isUploadingEvidence || resolveIncident.isPending} onClick={uploadEvidenceAndConfirm}>
                    {isUploadingEvidence ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-2 h-4 w-4" />}
                    {isUploadingEvidence ? 'Uploading Evidence...' : 'Mark as Resolved'}
                  </Button>
                </div>
              ) : null}

              {isAdmin && alert.status === 'resolved' ? (
                <div className="space-y-3">
                  <label htmlFor="review-note" className="text-sm font-medium">Admin Review Note (optional)</label>
                  <textarea id="review-note" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} maxLength={4000} className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Review observations before closing" />
                  <Button className="w-full" onClick={() => setConfirmAction('close')}><CheckCircle2 className="mr-2 h-4 w-4" />Close Incident</Button>
                </div>
              ) : null}

              {['resolved', 'closed'].includes(alert.status) && !isAdmin ? <p className="rounded-lg bg-muted/50 p-4 text-center text-sm text-muted-foreground">Officer workflow is complete. Admin review is {alert.status === 'resolved' ? 'pending' : 'complete'}.</p> : null}
              {isAdmin && !ADMIN_ASSIGNABLE_STATUSES.has(normalizedAlertStatus) && normalizedAlertStatus !== 'resolved' ? <p className="rounded-lg bg-muted/50 p-4 text-center text-sm text-muted-foreground">No Admin action is available for the current status.</p> : null}
              {isOfficer && !isAssignedToCurrentOfficer ? <p className="text-sm text-destructive">This incident is not assigned to your account.</p> : null}
            </CardContent>
          </Card>

          {canEditOfficerNote ? (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><StickyNote className="h-5 w-5 text-amber-500" />Officer Note</CardTitle><CardDescription>Internal operational note.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {editingNote ? (
                  <>
                    <textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} maxLength={2000} className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                    <div className="flex gap-2"><Button size="sm" onClick={handleSaveNote} disabled={!noteText.trim() || addOfficerNote.isPending}>{addOfficerNote.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save</Button><Button size="sm" variant="ghost" onClick={() => setEditingNote(false)}>Cancel</Button></div>
                  </>
                ) : (
                  <><p className="whitespace-pre-wrap text-sm text-muted-foreground">{alert.officerNote || 'No note added.'}</p><Button size="sm" variant="outline" onClick={() => { setNoteText(alert.officerNote || ''); setEditingNote(true); }}>{alert.officerNote ? 'Edit Note' : 'Add Note'}</Button></>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent className="p-5"><IncidentLocationDetails address={alert.address} latitude={latitude} longitude={longitude} /></CardContent>
            <CardContent className="overflow-hidden rounded-b-xl border-t p-0">
              {hasCoordinates ? (
                <div className="h-64 w-full"><MapContainer center={[latitude, longitude]} zoom={15} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><Marker position={[latitude, longitude]}><Popup>{alert.address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`}</Popup></Marker></MapContainer></div>
              ) : <div className="flex h-48 items-center justify-center text-sm text-muted-foreground"><MapPin className="mr-2 h-4 w-4" />Location not available</div>}
            </CardContent>
          </Card>
        </aside>
      </div>

      <ConfirmActionDialog open={confirmAction === 'assign'} onOpenChange={(open) => !open && setConfirmAction(null)} title="Assign this incident?" description="The selected Officer will receive this incident as a new task." confirmLabel="Assign Incident" isPending={assignOfficer.isPending} onConfirm={handleAssign} />
      <ConfirmActionDialog open={confirmAction === 'start'} onOpenChange={(open) => !open && setConfirmAction(null)} title="Start handling this incident?" description="The Citizen will be notified and the incident will move to In Progress." confirmLabel="Start Handling" pendingLabel="Starting..." isPending={startHandling.isPending} onConfirm={handleStart} />
      <ConfirmActionDialog open={confirmAction === 'arrival'} onOpenChange={(open) => !open && setConfirmAction(null)} title="Confirm arrival at the scene?" description="Your arrival time will be recorded. Location permission is not required." confirmLabel="Confirm Arrival" pendingLabel="Confirming..." isPending={confirmArrival.isPending} onConfirm={handleArrival} />
      <ConfirmActionDialog open={confirmAction === 'resolve'} onOpenChange={(open) => !open && setConfirmAction(null)} title="Mark this incident as resolved?" description="Resolution notes and after-treatment evidence will be submitted for Admin review." confirmLabel="Mark as Resolved" pendingLabel="Resolving..." isPending={resolveIncident.isPending} onConfirm={handleResolve} />
      <ConfirmActionDialog open={confirmAction === 'close'} onOpenChange={(open) => !open && setConfirmAction(null)} title="Close this incident?" description="This completes the workflow after Admin review. The Citizen and assigned Officer will be notified." confirmLabel="Close Incident" pendingLabel="Closing..." destructive isPending={closeIncident.isPending} onConfirm={handleClose} />
    </div>
  );
}
