import { AlertCategory, Severity } from '../enums';

export type AiAnalysisMode = 'text' | 'vision' | 'text_fallback';

export interface IAiAnalysisCompletedData {
  alertId: string;
  analysisId: string;
  category: AlertCategory;
  severity: Severity;
  confidence: number;
  summary: string;
  reasoningSummary: string;
  analysisMode: AiAnalysisMode;
  provider: 'openrouter';
  model: string;
}
