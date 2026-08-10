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
import { useQueryClient } from '@tanstack/react-query';
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
import { useLanguage } from '@/contexts/LanguageContext';
import { getApiErrorMessage } from '@/lib/api-error';
import { hasValidCoordinates } from '@/lib/maps';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { IncidentLocationDetails } from '@/components/location/IncidentLocationDetails';
import { ConfirmActionDialog } from '@/components/incidents/ConfirmActionDialog';
import { IncidentTimeline } from '@/components/incidents/IncidentTimeline';
import type { AlertCategory, ResolutionInput } from '@/types';
import 'leaflet/dist/leaflet.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

const MAX_EVIDENCE_SIZE = 10 * 1024 * 1024;
const MAX_EVIDENCE_COUNT = 20;
const ADMIN_ASSIGNABLE_STATUSES = new Set(['verified']);

type ConfirmAction = 'verify' | 'assign' | 'start' | 'arrival' | 'resolve' | 'close' | null;
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
  const { t } = useLanguage();
  const { data: alert, isLoading, isError, error } = useAlert(id);
  const { data: officerData } = useUsers(1, 100, 'OFFICER', undefined, role === 'ADMIN');
  const assignOfficer = useAssignOfficer();
  const startHandling = useStartHandling();
  const confirmArrival = useConfirmArrival();
  const resolveIncident = useResolveIncident();
  const closeIncident = useCloseIncident();
  const addOfficerNote = useAddOfficerNote();
  const queryClient = useQueryClient();

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
  const [classificationCategory, setClassificationCategory] = useState<AlertCategory | ''>('');
  const [isReviewingClassification, setIsReviewingClassification] = useState(false);
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
  const canAdminVerify = isAdmin && normalizedAlertStatus === 'pending';
  const isAssignedToCurrentOfficer = isOfficer && alert.assignedOfficerId === user?._id;
  // The API query is already scoped to OFFICER; keep this boundary guard so only
  // valid assignees can be rendered if an unexpected response is returned.
  const officers = (officerData?.items ?? []).filter((user) => user.role === 'OFFICER');
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

  const handleVerify = async () => {
    try {
      await alertService.updateStatus(id, 'verified');
      await queryClient.invalidateQueries({ queryKey: ['alert', id] });
      await queryClient.invalidateQueries({ queryKey: ['alerts'] });
      toast.success('Báo cáo đã được Admin xác minh.');
      setConfirmAction(null);
    } catch (workflowError) { onWorkflowError(workflowError, 'Không thể xác minh báo cáo.'); }
  };

  const handleReviewClassification = async () => {
    try {
      setIsReviewingClassification(true);
      await alertService.reviewClassification(id, classificationCategory || undefined);
      await queryClient.invalidateQueries({ queryKey: ['alert', id] });
      toast.success('Đã cập nhật phân loại.');
    } catch (workflowError) { toast.error(getApiErrorMessage(workflowError, 'Không thể cập nhật phân loại.')); }
    finally { setIsReviewingClassification(false); }
  };

  const handleAssign = () => {
    if (!selectedOfficerId) return;
    assignOfficer.mutate(
      { id, officerId: selectedOfficerId },
      {
        onSuccess: () => {
          toast.success(t('toast.officer_assigned_success'), {
            id: `alert-updated-${id}`,
          });
          setConfirmAction(null);
        },
        onError: (mutationError) => onWorkflowError(mutationError, 'Unable to assign this incident.'),
      },
    );
  };

  const handleStart = () => {
    startHandling.mutate(id, {
      onSuccess: () => {
        toast.success(t('toast.handling_started_success'), {
          id: `alert-updated-${id}`,
        });
        setConfirmAction(null);
      },
      onError: (mutationError) => onWorkflowError(mutationError, 'Unable to start handling.'),
    });
  };

  const handleArrival = () => {
    toast('GPS check-in requires a fresh foreground location. Please use the EcoAlert mobile officer app on site.', { icon: '📍' });
    setConfirmAction(null);
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
          toast.success(t('toast.incident_resolved_success'), {
            id: `alert-updated-${id}`,
          });
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
          toast.success(t('toast.incident_closed_success'), {
            id: `alert-updated-${id}`,
          });
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
          <Link to={isAdmin ? '/admin/reports' : '/officer/assigned'}><ChevronLeft className="mr-2 h-4 w-4" />Quay lại danh sách</Link>
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
                <Badge variant="outline" className="capitalize">Mức độ {alert.severity}</Badge>
              </div>
              <div className="flex flex-wrap gap-4 pt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{format(new Date(alert.createdAt), 'PP')}</span>
                <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{format(new Date(alert.createdAt), 'p')}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="whitespace-pre-wrap leading-relaxed">{alert.description}</p>
              <div>
                <h3 className="mb-3 flex items-center gap-2 font-semibold"><ImageIcon className="h-4 w-4" />Minh chứng từ Người dân ({originalEvidence.length})</h3>
                {originalEvidence.length ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {originalEvidence.map((url, index) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="aspect-video overflow-hidden rounded-lg border bg-muted">
                        <img src={url} alt={`Minh chứng ${index + 1}`} className="h-full w-full object-cover transition hover:scale-105" />
                      </a>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">Người dân chưa gửi hình ảnh minh chứng.</p>}
              </div>
            </CardContent>
          </Card>

          {(alert.resolutionSummary || resolutionEvidence.length > 0) ? (
            <Card className="border-emerald-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5 text-emerald-600" />Chi tiết xử lý của Cán bộ</CardTitle>
                <CardDescription>Hồ sơ phương pháp và kết quả xử lý do Cán bộ lưu trữ.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><p className="text-xs font-semibold uppercase text-muted-foreground">Tóm tắt kết quả</p><p className="mt-1 whitespace-pre-wrap text-sm">{alert.resolutionSummary || 'Chưa cung cấp'}</p></div>
                  <div><p className="text-xs font-semibold uppercase text-muted-foreground">Phương pháp xử lý</p><p className="mt-1 whitespace-pre-wrap text-sm">{alert.treatmentMethod || 'Chưa cung cấp'}</p></div>
                  {alert.materialsUsed ? <div><p className="text-xs font-semibold uppercase text-muted-foreground">Vật tư & Thiết bị</p><p className="mt-1 whitespace-pre-wrap text-sm">{alert.materialsUsed}</p></div> : null}
                  {alert.resolutionNotes ? <div><p className="text-xs font-semibold uppercase text-muted-foreground">Ghi chú bổ sung</p><p className="mt-1 whitespace-pre-wrap text-sm">{alert.resolutionNotes}</p></div> : null}
                </div>
                <div>
                  <p className="mb-3 text-sm font-semibold">Hình ảnh sau xử lý ({resolutionEvidence.length})</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {resolutionEvidence.map((item, index) => (
                      <a key={item._id || item.url} href={item.url} target="_blank" rel="noopener noreferrer" className="aspect-video overflow-hidden rounded-lg border bg-muted">
                        <img src={item.url} alt={`Hình ảnh sau xử lý ${index + 1}`} className="h-full w-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
                {alert.adminReviewNote ? <div className="rounded-lg border bg-muted/40 p-3"><p className="text-xs font-semibold uppercase text-muted-foreground">Ghi chú duyệt của Admin</p><p className="mt-1 text-sm">{alert.adminReviewNote}</p></div> : null}
              </CardContent>
            </Card>
          ) : null}

          <IncidentTimeline entries={alert.timeline} createdAt={alert.createdAt} citizenId={alert.citizenId} />

          <Card>
            <CardHeader><CardTitle className="text-lg">Lịch sử trạng thái</CardTitle><CardDescription>Nhật ký chuyển đổi trạng thái do máy chủ lưu trữ.</CardDescription></CardHeader>
            <CardContent>
              {statusHistory.length ? (
                <div className="space-y-3">
                  {[...statusHistory].sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()).map((entry, index) => (
                    <div key={entry._id || `${entry.changedAt}-${index}`} className="flex flex-col justify-between gap-2 rounded-lg border p-3 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="capitalize">{entry.fromStatus?.replace(/_/g, ' ') || 'khởi tạo'}</Badge>
                        <span>→</span>
                        <Badge className="capitalize">{entry.toStatus.replace(/_/g, ' ')}</Badge>
                        <span className="text-muted-foreground">bởi {entry.changedByRole.toLowerCase()}</span>
                      </div>
                      <time className="text-xs text-muted-foreground">{formatTimestamp(entry.changedAt)}</time>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">Sự cố này chưa có lịch sử trạng thái được ghi lại.</p>}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><UserCheck className="h-5 w-5" />Phân công Cán bộ</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Cán bộ phụ trách</span><span className="text-right font-medium">{assignedOfficerLabel}</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Ngày phân công</span><span className="text-right">{formatTimestamp(alert.assignedAt)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Trạng thái</span><Badge className="capitalize">{alert.status.replace(/_/g, ' ')}</Badge></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Bắt đầu xử lý</span><span className="text-right">{formatTimestamp(alert.startedAt)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Thời gian đến nơi</span><span className="text-right">{formatTimestamp(alert.arrivedAt)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Hoàn thành</span><span className="text-right">{formatTimestamp(alert.resolvedAt)}</span></div>
              {alert.arrivedAt ? <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 p-3 text-emerald-700 dark:text-emerald-300"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span>Cán bộ đã có mặt tại hiện trường.</span></div> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">{isAdmin ? 'Admin Duyệt' : 'Hành động Cán bộ'}</CardTitle><CardDescription>Hành động tiếp theo có thể thực hiện.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {isAdmin ? (
                <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                  <div><p className="text-sm font-semibold">Phân loại do con người quyết định</p><p className="mt-1 text-xs text-muted-foreground">AI: {alert.classification?.aiSuggestedCategory || 'UNCLASSIFIED'}{alert.classification?.aiConfidence !== undefined && alert.classification?.aiConfidence !== null ? ` · ${Math.round(alert.classification.aiConfidence * 100)}%` : ''}</p><p className="text-xs text-muted-foreground">Người dân: {alert.classification?.citizenSelectedCategory || 'Chưa chọn'} · {alert.classification?.status || 'UNCLASSIFIED'}</p></div>
                  <select value={classificationCategory} onChange={(event) => setClassificationCategory(event.target.value as AlertCategory | '')} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"><option value="">Xác nhận danh mục hiện tại</option><option value="illegal_dumping">Rác thải / đổ trộm</option><option value="water_pollution">Ô nhiễm nước</option><option value="air_pollution">Ô nhiễm không khí</option><option value="illegal_burning">Đốt rác</option><option value="flooding">Ngập lụt</option><option value="fallen_tree">Cây đổ</option><option value="illegal_construction_waste">Chất thải xây dựng</option><option value="noise_pollution">Ô nhiễm tiếng ồn</option><option value="soil_contamination">Ô nhiễm đất</option><option value="wildlife_threat">Đe dọa động vật</option><option value="other">Khác</option></select>
                  <Button size="sm" variant="outline" className="w-full" onClick={handleReviewClassification} disabled={isReviewingClassification || !['pending', 'verified'].includes(normalizedAlertStatus)}>{isReviewingClassification ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Xác nhận / chỉnh sửa phân loại</Button>
                </div>
              ) : null}

              {canAdminVerify ? <Button className="w-full" onClick={() => void handleVerify()}><ShieldCheck className="mr-2 h-4 w-4" />Xác minh báo cáo</Button> : null}
              {canAdminAssign ? (
                <div className="space-y-3">
                  <label htmlFor="assigned-officer" className="text-sm font-medium">Phân công cho Cán bộ</label>
                  <select id="assigned-officer" value={selectedOfficerId} onChange={(event) => setSelectedOfficerId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Chọn Cán bộ</option>
                    {officers.map((officer) => <option key={officer._id} value={officer._id}>{officer.fullName} · {officer.email}</option>)}
                  </select>
                  <Button className="w-full" disabled={!selectedOfficerId} onClick={() => setConfirmAction('assign')}><UserCheck className="mr-2 h-4 w-4" />Xác nhận Phân công</Button>
                </div>
              ) : null}

              {isAssignedToCurrentOfficer && alert.status === 'assigned' ? (
                <Button className="w-full" onClick={() => setConfirmAction('start')}><PlayCircle className="mr-2 h-4 w-4" />Bắt đầu xử lý</Button>
              ) : null}

              {isAssignedToCurrentOfficer && alert.status === 'in_progress' && !alert.arrivedAt ? (
                <Button className="w-full" onClick={() => setConfirmAction('arrival')}><MapPin className="mr-2 h-4 w-4" />Xác nhận đã đến hiện trường</Button>
              ) : null}

              {isAssignedToCurrentOfficer && alert.status === 'in_progress' && alert.arrivedAt ? (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm"><p className="font-medium">Minh chứng & Báo cáo kết quả</p><p className="mt-1 text-muted-foreground">Các trường có dấu (*) là bắt buộc.</p></div>
                  <div><label htmlFor="resolution-summary" className="text-sm font-medium">Tóm tắt kết quả xử lý *</label><textarea id="resolution-summary" value={resolutionSummary} onChange={(event) => setResolutionSummary(event.target.value)} maxLength={4000} className="mt-1 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Sự cố đã được giải quyết thế nào?" /></div>
                  <div><label htmlFor="treatment-method" className="text-sm font-medium">Phương pháp xử lý *</label><textarea id="treatment-method" value={treatmentMethod} onChange={(event) => setTreatmentMethod(event.target.value)} maxLength={4000} className="mt-1 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Các biện pháp đã áp dụng tại hiện trường" /></div>
                  <div><label htmlFor="materials-used" className="text-sm font-medium">Vật tư / Thiết bị sử dụng</label><textarea id="materials-used" value={materialsUsed} onChange={(event) => setMaterialsUsed(event.target.value)} maxLength={2000} className="mt-1 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                  <div><label htmlFor="additional-notes" className="text-sm font-medium">Ghi chú bổ sung</label><textarea id="additional-notes" value={additionalNotes} onChange={(event) => setAdditionalNotes(event.target.value)} maxLength={4000} className="mt-1 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                  <div className="space-y-3">
                    <label htmlFor="resolution-evidence" className="text-sm font-medium">Hình ảnh sau xử lý * ({evidenceDrafts.length}/{MAX_EVIDENCE_COUNT})</label>
                    <label htmlFor="resolution-evidence" className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed p-5 text-sm text-muted-foreground transition hover:border-primary hover:text-primary"><Upload className="mr-2 h-4 w-4" />Chọn ảnh từ thiết bị</label>
                    <input id="resolution-evidence" type="file" accept="image/*" multiple className="sr-only" onChange={(event) => { addEvidenceFiles(event.target.files); event.target.value = ''; }} />
                    <div className="grid grid-cols-2 gap-2">
                      {evidenceDrafts.map((draft) => (
                        <div key={draft.id} className="relative overflow-hidden rounded-lg border bg-muted">
                          <img src={draft.previewUrl} alt="Xem trước ảnh sau xử lý" className="aspect-square h-full w-full object-cover" />
                          <button type="button" onClick={() => removeEvidence(draft.id)} disabled={draft.state === 'uploading'} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white disabled:opacity-50" aria-label={`Xóa ${draft.file.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
                          <div className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1 text-[10px] text-white">
                            {draft.state === 'uploading' ? `Đang tải ${draft.progress}%` : draft.state === 'failed' ? draft.error : draft.state === 'uploaded' ? 'Đã tải lên' : `${(draft.file.size / 1024 / 1024).toFixed(1)} MB`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={!resolutionFieldsValid || isUploadingEvidence || resolveIncident.isPending} onClick={uploadEvidenceAndConfirm}>
                    {isUploadingEvidence ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-2 h-4 w-4" />}
                    {isUploadingEvidence ? 'Đang tải ảnh...' : 'Đánh dấu đã Hoàn thành'}
                  </Button>
                </div>
              ) : null}

              {isAdmin && alert.status === 'resolved' ? (
                <div className="space-y-3">
                  <label htmlFor="review-note" className="text-sm font-medium">Ghi chú duyệt của Admin (tùy chọn)</label>
                  <textarea id="review-note" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} maxLength={4000} className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Ghi chú đánh giá trước khi đóng sự cố" />
                  <Button className="w-full" onClick={() => setConfirmAction('close')}><CheckCircle2 className="mr-2 h-4 w-4" />Đóng Sự cố</Button>
                </div>
              ) : null}

              {['resolved', 'closed'].includes(alert.status) && !isAdmin ? <p className="rounded-lg bg-muted/50 p-4 text-center text-sm text-muted-foreground">Quy trình xử lý của Cán bộ đã hoàn tất. Đánh giá của Admin đang {alert.status === 'resolved' ? 'chờ xử lý' : 'hoàn tất'}.</p> : null}
              {isAdmin && !ADMIN_ASSIGNABLE_STATUSES.has(normalizedAlertStatus) && normalizedAlertStatus !== 'resolved' ? <p className="rounded-lg bg-muted/50 p-4 text-center text-sm text-muted-foreground">Không có hành động khả dụng cho trạng thái hiện tại.</p> : null}
              {isOfficer && !isAssignedToCurrentOfficer ? <p className="text-sm text-destructive">Sự cố này chưa được phân công cho tài khoản của bạn.</p> : null}
            </CardContent>
          </Card>

          {canEditOfficerNote ? (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><StickyNote className="h-5 w-5 text-amber-500" />Ghi chú Cán bộ</CardTitle><CardDescription>Ghi chú nghiệp vụ nội bộ.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {editingNote ? (
                  <>
                    <textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} maxLength={2000} className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                    <div className="flex gap-2"><Button size="sm" onClick={handleSaveNote} disabled={!noteText.trim() || addOfficerNote.isPending}>{addOfficerNote.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Lưu ghi chú</Button><Button size="sm" variant="ghost" onClick={() => setEditingNote(false)}>Hủy</Button></div>
                  </>
                ) : (
                  <><p className="whitespace-pre-wrap text-sm text-muted-foreground">{alert.officerNote || 'Chưa có ghi chú.'}</p><Button size="sm" variant="outline" onClick={() => { setNoteText(alert.officerNote || ''); setEditingNote(true); }}>{alert.officerNote ? 'Sửa ghi chú' : 'Thêm ghi chú'}</Button></>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent className="p-5"><IncidentLocationDetails address={alert.address} latitude={latitude} longitude={longitude} /></CardContent>
            <CardContent className="overflow-hidden rounded-b-xl border-t p-0">
              {hasCoordinates ? (
                <div className="h-64 w-full"><MapContainer center={[latitude, longitude]} zoom={15} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><Marker position={[latitude, longitude]}><Popup>{alert.address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`}</Popup></Marker></MapContainer></div>
              ) : <div className="flex h-48 items-center justify-center text-sm text-muted-foreground"><MapPin className="mr-2 h-4 w-4" />Không có vị trí</div>}
            </CardContent>
          </Card>
        </aside>
      </div>

      <ConfirmActionDialog open={confirmAction === 'assign'} onOpenChange={(open) => !open && setConfirmAction(null)} title="Phân công sự cố này?" description="Cán bộ được chọn sẽ nhận sự cố này làm nhiệm vụ mới." confirmLabel="Phân công Cán bộ" isPending={assignOfficer.isPending} onConfirm={handleAssign} />
      <ConfirmActionDialog open={confirmAction === 'start'} onOpenChange={(open) => !open && setConfirmAction(null)} title="Bắt đầu xử lý sự cố?" description="Người dân sẽ nhận được thông báo và trạng thái chuyển sang Đang xử lý." confirmLabel="Bắt đầu Xử lý" pendingLabel="Đang khởi tạo..." isPending={startHandling.isPending} onConfirm={handleStart} />
      <ConfirmActionDialog open={confirmAction === 'arrival'} onOpenChange={(open) => !open && setConfirmAction(null)} title="Xác nhận đã tới hiện trường?" description="Thời gian tới hiện trường của bạn sẽ được ghi lại hệ thống." confirmLabel="Xác nhận Đã tới" pendingLabel="Đang xác nhận..." isPending={confirmArrival.isPending} onConfirm={handleArrival} />
      <ConfirmActionDialog open={confirmAction === 'resolve'} onOpenChange={(open) => !open && setConfirmAction(null)} title="Đánh dấu đã hoàn thành xử lý?" description="Hồ sơ kết quả và minh chứng sau xử lý sẽ được gửi để Admin xem xét." confirmLabel="Đánh dấu Hoàn thành" pendingLabel="Đang gửi..." isPending={resolveIncident.isPending} onConfirm={handleResolve} />
      <ConfirmActionDialog open={confirmAction === 'close'} onOpenChange={(open) => !open && setConfirmAction(null)} title="Đóng sự cố này?" description="Thao tác này hoàn tất quy trình xử lý sau khi Admin phê duyệt." confirmLabel="Đóng Sự cố" pendingLabel="Đang đóng..." destructive isPending={closeIncident.isPending} onConfirm={handleClose} />
    </div>
  );
}
