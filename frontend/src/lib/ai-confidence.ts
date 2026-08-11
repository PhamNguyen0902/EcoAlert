import type { Alert, Severity } from '@/types';

export interface AlertDisplayConfidence {
  value: number | null;
  source: 'FUSION' | 'CATEGORY' | 'SEMANTIC' | 'NONE';
}

const isConfidence = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

/** Consumes the server-resolved value and safely handles the known VISION_ONLY legacy record shape. */
export const getAlertDisplayConfidence = (alert: Alert): AlertDisplayConfidence => {
  if (alert.aiAnalysisMode === 'VISION_ONLY' && !alert.aiOverallAnalysis) {
    return { value: null, source: 'NONE' };
  }
  if (isConfidence(alert.aiConfidence)) {
    return { value: alert.aiConfidence, source: alert.aiConfidenceSource ?? 'CATEGORY' };
  }
  return { value: null, source: 'NONE' };
};

export const getAlertDisplaySeverity = (alert: Alert): Severity | null =>
  alert.aiAnalysisMode === 'VISION_ONLY' && !alert.aiOverallAnalysis
    ? null
    : alert.aiSuggestedPriority ?? alert.severity;
