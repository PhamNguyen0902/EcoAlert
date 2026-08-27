import type { Alert, Severity } from '@/types';

export interface AlertDisplayConfidence {
  value: number | null;
  source: 'CATEGORY' | 'SEMANTIC' | 'NONE';
}

const isConfidence = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

/** Consumes the server-resolved direct OpenRouter confidence. */
export const getAlertDisplayConfidence = (alert: Alert): AlertDisplayConfidence => {
  if (alert.aiAnalysisMode === 'FAILED') {
    return { value: null, source: 'NONE' };
  }
  if (isConfidence(alert.aiConfidence)) {
    return { value: alert.aiConfidence, source: alert.aiConfidenceSource ?? 'CATEGORY' };
  }
  return { value: null, source: 'NONE' };
};

export const getAlertDisplaySeverity = (alert: Alert): Severity | null =>
  alert.aiAnalysisMode === 'FAILED' ? null : alert.aiSuggestedPriority ?? alert.severity;
