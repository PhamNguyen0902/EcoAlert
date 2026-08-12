import { Check, CircleDot, Clock3, XCircle } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { useLanguage, type Language } from '@/contexts/LanguageContext';
import { getCategoryDisplay, getSeverityDisplay, getStatusDisplay } from '@/lib/domain-i18n';
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

export const getStatusLabel = (status?: string | null, language: Language = 'vi') => getStatusDisplay(language, status);
export const getSeverityLabel = (severity?: string | null, language: Language = 'vi') => getSeverityDisplay(language, severity);

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

const lifecycle: AlertStatus[] = ['pending', 'verified', 'assigned', 'in_progress', 'resolved', 'closed'];

const statusDescriptions: Record<NormalizedIncidentStatus, Record<Language, string>> = {
  pending: { vi: 'Báo cáo của bạn đã được tiếp nhận và đang chờ xác minh.', en: 'Your report has been received and is waiting for verification.' },
  ai_analyzing: { vi: 'Bằng chứng đang được AI phân tích để hỗ trợ phân loại.', en: 'Your evidence is being analyzed to help the team triage the report.' },
  verified: { vi: 'Báo cáo đã được xác minh và sẵn sàng phân công.', en: 'Your report has been verified and is ready for assignment.' },
  assigned: { vi: 'Báo cáo đã được phân công cho cán bộ.', en: 'Your report has been assigned to an officer.' },
  in_progress: { vi: 'Cán bộ đang xử lý sự cố này.', en: 'An officer is currently handling this incident.' },
  resolved: { vi: 'Cán bộ đã xử lý xong. Kết quả đang chờ rà soát cuối cùng.', en: 'The assigned officer has completed treatment. The result is awaiting final review.' },
  closed: { vi: 'Sự cố đã được rà soát và đóng.', en: 'This incident has been reviewed and closed.' },
  rejected: { vi: 'Báo cáo này không được chấp nhận vào quy trình xử lý sự cố.', en: 'This report was not accepted for the incident workflow.' },
  unknown: { vi: 'Không xác định được trạng thái quy trình hiện tại.', en: 'The current workflow status is unavailable.' },
};

export function getStatusDescription(status?: string | null, language: Language = 'vi') {
  return statusDescriptions[normalizeIncidentStatus(status)][language];
}

export function formatIncidentCategory(category?: string | null, language: Language = 'vi') {
  return getCategoryDisplay(language, category);
}

export function IncidentStatusProgress({ status }: { status?: string | null }) {
  const { language } = useLanguage();
  const normalized = normalizeIncidentStatus(status);
  const currentIndex = normalized === 'ai_analyzing' ? 0 : lifecycle.findIndex((stage) => stage === normalized);
  const copy = language === 'vi'
    ? { rejected: 'Trạng thái báo cáo: đã từ chối', progress: 'Tiến độ trạng thái', workflow: 'Các giai đoạn xử lý sự cố', complete: 'hoàn tất', current: 'hiện tại' }
    : { rejected: 'Report status: rejected', progress: 'Status progress', workflow: 'Incident workflow stages', complete: 'complete', current: 'current' };

  if (normalized === 'rejected') {
    return (
      <section className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-4" aria-labelledby="status-progress-heading">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"><XCircle className="h-5 w-5" aria-hidden="true" /></span>
          <div>
            <h2 id="status-progress-heading" className="font-semibold">{copy.rejected}</h2>
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
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.progress}</p>
          <h2 id="status-progress-heading" className="mt-1 font-semibold">{getStatusDescription(normalized, language)}</h2>
        </div>
        <StatusBadge status={normalized} className="w-fit" />
      </div>

      <ol className="mt-5 grid grid-cols-3 gap-y-4 sm:grid-cols-6" aria-label={copy.workflow}>
        {lifecycle.map((stage, index) => {
          const isComplete = currentIndex > index;
          const isCurrent = currentIndex === index;
          return (
          <li key={stage} className="relative flex min-w-0 flex-col items-start sm:items-center sm:text-center">
              {index < lifecycle.length - 1 ? <span className={cn('absolute left-5 right-0 top-4 hidden h-px sm:block', isComplete ? 'bg-primary' : 'bg-border')} aria-hidden="true" /> : null}
              <span className={cn('relative z-10 flex h-8 w-8 items-center justify-center rounded-full border bg-card', isComplete && 'border-primary bg-primary text-primary-foreground', isCurrent && 'border-primary text-primary ring-4 ring-primary/10', !isComplete && !isCurrent && 'border-border text-muted-foreground')}>
                {isComplete ? <Check className="h-3.5 w-3.5" aria-label={`${getStatusLabel(stage, language)} ${copy.complete}`} /> : isCurrent ? <CircleDot className="h-3.5 w-3.5" aria-label={`${getStatusLabel(stage, language)} ${copy.current}`} /> : <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />}
              </span>
              <span className={cn('mt-2 pr-2 text-xs font-medium sm:pr-0', (isComplete || isCurrent) ? 'text-foreground' : 'text-muted-foreground')}>{getStatusLabel(stage, language)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
