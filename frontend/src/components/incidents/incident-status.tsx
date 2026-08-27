import { Check, CircleDot, Clock3, XCircle } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { useLanguage, type Language } from '@/contexts/LanguageContext';
import {
  getIncidentCategoryLabel,
  getIncidentSeverityLabel,
  getIncidentStatusLabel,
} from '@/lib/incident-presentation';
import { cn } from '@/lib/utils';
import type { AlertStatus, Severity } from '@/types';

export type NormalizedIncidentStatus = AlertStatus | 'unknown';

const validStatuses = new Set<AlertStatus>([
  'pending', 'ai_analyzing', 'verified', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected',
]);
const validSeverities = new Set<Severity>(['low', 'medium', 'high', 'critical']);

export function normalizeIncidentStatus(status?: string | null): NormalizedIncidentStatus {
  const normalized = status?.trim().toLowerCase().replace(/[\s-]+/g, '_') ?? '';
  return validStatuses.has(normalized as AlertStatus) ? normalized as AlertStatus : 'unknown';
}

export function normalizeSeverity(severity?: string | null): Severity | 'unknown' {
  const normalized = severity?.trim().toLowerCase() ?? '';
  return validSeverities.has(normalized as Severity) ? normalized as Severity : 'unknown';
}

export const getStatusLabel = (status?: string | null, language: Language = 'vi') => getIncidentStatusLabel(normalizeIncidentStatus(status), language);
export const getSeverityLabel = (severity?: string | null, language: Language = 'vi') => getIncidentSeverityLabel(normalizeSeverity(severity), language);

export const getStatusBadgeVariant = (status?: string | null): BadgeProps['variant'] => {
  const normalized = normalizeIncidentStatus(status);
  if (normalized === 'rejected') return 'destructive';
  if (normalized === 'resolved' || normalized === 'closed') return 'success';
  if (normalized === 'pending' || normalized === 'ai_analyzing') return 'secondary';
  return 'outline';
};

export const getSeverityBadgeVariant = (severity?: string | null): BadgeProps['variant'] => {
  const normalized = normalizeSeverity(severity);
  if (normalized === 'critical') return 'destructive';
  if (normalized === 'high') return 'warning';
  return 'outline';
};

const statusBadgeClassName = (status?: string | null) => {
  switch (normalizeIncidentStatus(status)) {
    case 'verified': return 'border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300';
    case 'assigned': return 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300';
    case 'in_progress': return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300';
    case 'pending':
    case 'ai_analyzing': return 'border-primary/25 bg-primary/10 text-primary';
    default: return '';
  }
};

const severityBadgeClassName = (severity?: string | null) => {
  switch (normalizeSeverity(severity)) {
    case 'low': return 'border-slate-500/25 bg-slate-500/10 text-slate-700 dark:text-slate-300';
    case 'medium': return 'border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300';
    default: return '';
  }
};

export function StatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const { language } = useLanguage();
  return <Badge variant={getStatusBadgeVariant(status)} className={cn('gap-1.5 border px-2.5 py-1 font-semibold', statusBadgeClassName(status), className)}>{getStatusLabel(status, language)}</Badge>;
}

export function SeverityBadge({ severity, className }: { severity?: string | null; className?: string }) {
  const { language } = useLanguage();
  return <Badge variant={getSeverityBadgeVariant(severity)} className={cn('border px-2.5 py-1 font-semibold', severityBadgeClassName(severity), className)}>{getSeverityLabel(severity, language)}</Badge>;
}

const lifecycle: AlertStatus[] = [
  'pending', 'verified', 'assigned', 'in_progress', 'resolved', 'closed',
];

const statusDescriptions: Record<Language, Record<NormalizedIncidentStatus, string>> = {
  vi: {
    pending: 'Báo cáo của bạn đã được tiếp nhận và đang chờ xử lý.',
    ai_analyzing: 'Minh chứng đang được AI phân loại để hỗ trợ xử lý.',
    verified: 'Báo cáo của bạn đã được xác minh và sẵn sàng phân công.',
    assigned: 'Báo cáo của bạn đã được phân công cho cán bộ xử lý.',
    in_progress: 'Cán bộ đang trực tiếp xử lý sự cố này.',
    resolved: 'Cán bộ được phân công đã hoàn thành xử lý. Kết quả đang chờ đánh giá.',
    closed: 'Sự cố này đã được xem xét và đóng.',
    rejected: 'Báo cáo này không được tiếp nhận vào quy trình xử lý.',
    unknown: 'Trạng thái quy trình xử lý tạm thời không khả dụng.',
  },
  en: {
    pending: 'Your report has been received and is waiting to be handled.',
    ai_analyzing: 'The evidence is being classified by AI to support handling.',
    verified: 'Your report has been verified and is ready for assignment.',
    assigned: 'Your report has been assigned to an officer.',
    in_progress: 'An officer is handling this incident.',
    resolved: 'The assigned officer has completed handling. The outcome is waiting for evaluation.',
    closed: 'This incident has been reviewed and closed.',
    rejected: 'This report was not accepted into the handling workflow.',
    unknown: 'The workflow status is temporarily unavailable.',
  },
};

export function getStatusDescription(status?: string | null, language: Language = 'vi') {
  return statusDescriptions[language][normalizeIncidentStatus(status)];
}

export function formatIncidentCategory(category?: string | null, language: Language = 'vi') {
  return getIncidentCategoryLabel(category, language);
}

export function IncidentStatusProgress({ status }: { status?: string | null }) {
  const { language } = useLanguage();
  const normalized = normalizeIncidentStatus(status);
  const currentIndex = normalized === 'ai_analyzing' ? 0 : lifecycle.indexOf(normalized as AlertStatus);
  const text = language === 'vi'
    ? { rejected: 'Trạng thái báo cáo: Đã từ chối', progress: 'Tiến độ trạng thái', stages: 'Các giai đoạn quy trình sự cố', completed: 'đã hoàn tất', current: 'hiện tại' }
    : { rejected: 'Report status: Rejected', progress: 'Status progress', stages: 'Incident workflow stages', completed: 'completed', current: 'current' };

  if (normalized === 'rejected') {
    return (
      <section className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-4" aria-labelledby="status-progress-heading">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"><XCircle className="h-5 w-5" aria-hidden="true" /></span>
          <div>
            <h2 id="status-progress-heading" className="font-semibold">{text.rejected}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{getStatusDescription(normalized, language)}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border bg-card px-4 py-4 shadow-sm sm:px-5" aria-labelledby="status-progress-heading">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{text.progress}</p>
          <h2 id="status-progress-heading" className="mt-1 font-semibold">{getStatusDescription(normalized, language)}</h2>
        </div>
        <StatusBadge status={normalized} className="w-fit" />
      </div>

      <ol className="mt-5 grid grid-cols-3 gap-y-4 sm:grid-cols-6" aria-label={text.stages}>
        {lifecycle.map((stage, index) => {
          const isComplete = currentIndex > index;
          const isCurrent = currentIndex === index;
          const label = getStatusLabel(stage, language);
          return (
            <li key={stage} className="relative flex min-w-0 flex-col items-start sm:items-center sm:text-center">
              {index < lifecycle.length - 1 ? <span className={cn('absolute left-5 right-0 top-4 hidden h-px sm:block', isComplete ? 'bg-primary' : 'bg-border')} aria-hidden="true" /> : null}
              <span className={cn('relative z-10 flex h-8 w-8 items-center justify-center rounded-full border bg-card', isComplete && 'border-primary bg-primary text-primary-foreground', isCurrent && 'border-primary text-primary ring-4 ring-primary/10', !isComplete && !isCurrent && 'border-border text-muted-foreground')}>
                {isComplete ? <Check className="h-3.5 w-3.5" aria-label={`${label} ${text.completed}`} /> : isCurrent ? <CircleDot className="h-3.5 w-3.5" aria-label={`${label} ${text.current}`} /> : <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />}
              </span>
              <span className={cn('mt-2 pr-2 text-xs font-medium sm:pr-0', (isComplete || isCurrent) ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
