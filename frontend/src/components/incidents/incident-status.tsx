import { Check, CircleDot, Clock3, XCircle } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AlertStatus, Severity } from '@/types';

export type NormalizedIncidentStatus = AlertStatus | 'unknown';

const statusLabels: Record<NormalizedIncidentStatus, string> = {
  pending: 'Submitted',
  ai_analyzing: 'Analysis in progress',
  verified: 'Verified',
  assigned: 'Assigned',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
  rejected: 'Rejected',
  unknown: 'Status unavailable',
};

const severityLabels: Record<Severity | 'unknown', string> = {
  low: 'Low severity',
  medium: 'Medium severity',
  high: 'High severity',
  critical: 'Critical severity',
  unknown: 'Severity unavailable',
};

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

export const getStatusLabel = (status?: string | null) => statusLabels[normalizeIncidentStatus(status)];
export const getSeverityLabel = (severity?: string | null) => severityLabels[normalizeSeverity(severity)];

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
  return <Badge variant={getStatusBadgeVariant(status)} className={cn('gap-1.5 border px-2.5 py-1 font-semibold', statusBadgeClassName(status), className)}>{getStatusLabel(status)}</Badge>;
}

export function SeverityBadge({ severity, className }: { severity?: string | null; className?: string }) {
  return <Badge variant={getSeverityBadgeVariant(severity)} className={cn('border px-2.5 py-1 font-semibold', severityBadgeClassName(severity), className)}>{getSeverityLabel(severity)}</Badge>;
}

const lifecycle: Array<{ status: AlertStatus; label: string }> = [
  { status: 'pending', label: 'Submitted' },
  { status: 'verified', label: 'Verified' },
  { status: 'assigned', label: 'Assigned' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'resolved', label: 'Resolved' },
  { status: 'closed', label: 'Closed' },
];

const statusDescriptions: Record<NormalizedIncidentStatus, string> = {
  pending: 'Your report has been received and is waiting for verification.',
  ai_analyzing: 'Your evidence is being analyzed to help the team triage the report.',
  verified: 'Your report has been verified and is ready for assignment.',
  assigned: 'Your report has been assigned to an officer.',
  in_progress: 'An officer is currently handling this incident.',
  resolved: 'The assigned officer has completed treatment. The result is awaiting final review.',
  closed: 'This incident has been reviewed and closed.',
  rejected: 'This report was not accepted for the incident workflow.',
  unknown: 'The current workflow status is unavailable.',
};

export function getStatusDescription(status?: string | null) {
  return statusDescriptions[normalizeIncidentStatus(status)];
}

export function formatIncidentCategory(category?: string | null) {
  if (!category || category.toLowerCase() === 'unclassified') return 'Chưa phân loại (Cần kiểm tra thủ công)';
  return category.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function IncidentStatusProgress({ status }: { status?: string | null }) {
  const normalized = normalizeIncidentStatus(status);
  const currentIndex = normalized === 'ai_analyzing' ? 0 : lifecycle.findIndex((stage) => stage.status === normalized);

  if (normalized === 'rejected') {
    return (
      <section className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-4" aria-labelledby="status-progress-heading">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"><XCircle className="h-5 w-5" aria-hidden="true" /></span>
          <div>
            <h2 id="status-progress-heading" className="font-semibold">Report status: rejected</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{getStatusDescription(normalized)}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border bg-card px-4 py-4 shadow-sm sm:px-5" aria-labelledby="status-progress-heading">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status progress</p>
          <h2 id="status-progress-heading" className="mt-1 font-semibold">{getStatusDescription(normalized)}</h2>
        </div>
        <StatusBadge status={normalized} className="w-fit" />
      </div>

      <ol className="mt-5 grid grid-cols-3 gap-y-4 sm:grid-cols-6" aria-label="Incident workflow stages">
        {lifecycle.map((stage, index) => {
          const isComplete = currentIndex > index;
          const isCurrent = currentIndex === index;
          return (
            <li key={stage.status} className="relative flex min-w-0 flex-col items-start sm:items-center sm:text-center">
              {index < lifecycle.length - 1 ? <span className={cn('absolute left-5 right-0 top-4 hidden h-px sm:block', isComplete ? 'bg-primary' : 'bg-border')} aria-hidden="true" /> : null}
              <span className={cn('relative z-10 flex h-8 w-8 items-center justify-center rounded-full border bg-card', isComplete && 'border-primary bg-primary text-primary-foreground', isCurrent && 'border-primary text-primary ring-4 ring-primary/10', !isComplete && !isCurrent && 'border-border text-muted-foreground')}>
                {isComplete ? <Check className="h-3.5 w-3.5" aria-label={`${stage.label} complete`} /> : isCurrent ? <CircleDot className="h-3.5 w-3.5" aria-label={`${stage.label} current`} /> : <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />}
              </span>
              <span className={cn('mt-2 pr-2 text-xs font-medium sm:pr-0', (isComplete || isCurrent) ? 'text-foreground' : 'text-muted-foreground')}>{stage.label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
