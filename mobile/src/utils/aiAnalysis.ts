import type { Alert, AlertCategory, Severity } from "../types";
import {
  getCategoryLabel as getPresentationCategoryLabel,
  getSeverityLabel as getPresentationSeverityLabel,
  getStatusLabel as getPresentationStatusLabel,
} from "./incidentPresentation";

export const AI_POLL_INTERVAL_MS = 3_000;
export const AI_PENDING_WINDOW_MS = 60_000;

export type AiAnalysisState = "PENDING" | "COMPLETED" | "FAILED" | "UNAVAILABLE";

type SupportedLanguage = "en" | "vi";

export const hasCompletedAiClassification = (alert?: Alert | null): boolean => {
  return Boolean(alert?.aiAnalysisId || alert?.aiAnalyzedAt);
};

export const getAiAnalysisState = (
  alert?: Alert | null,
  now = Date.now(),
): AiAnalysisState => {
  if (!alert) return "UNAVAILABLE";

  const hasAnalysisMarker = Boolean(alert.aiAnalysisId || alert.aiAnalyzedAt);
  if (hasAnalysisMarker) return alert.aiAnalysisMode === "FAILED" ? "FAILED" : "COMPLETED";

  const createdAt = Date.parse(alert.createdAt);
  if (Number.isFinite(createdAt) && now - createdAt <= AI_PENDING_WINDOW_MS) {
    return "PENDING";
  }

  return "UNAVAILABLE";
};

export const shouldPollAiAnalysis = (alert?: Alert | null, now = Date.now()): boolean =>
  getAiAnalysisState(alert, now) === "PENDING";

export const getCategoryLabel = (
  category?: AlertCategory | null,
  language: SupportedLanguage = "en",
): string => getPresentationCategoryLabel(category, language);

export const getSeverityLabel = (severity?: Severity | null, language: SupportedLanguage = "vi"): string =>
  getPresentationSeverityLabel(severity, language);

export const getAlertDisplayConfidence = (alert?: Alert | null): { value: number | null; source: "CATEGORY" | "SEMANTIC" | "NONE" } => {
  if (!alert || alert.aiAnalysisMode === "FAILED") {
    return { value: null, source: "NONE" };
  }
  if (alert.aiConfidence !== null && alert.aiConfidence !== undefined && Number.isFinite(alert.aiConfidence) && alert.aiConfidence >= 0 && alert.aiConfidence <= 1) {
    return { value: alert.aiConfidence, source: alert.aiConfidenceSource ?? "CATEGORY" };
  }
  return { value: null, source: "NONE" };
};

export const getAlertDisplaySeverity = (alert?: Alert | null): Severity | null =>
  alert?.aiAnalysisMode === "FAILED" ? null : alert?.aiSuggestedPriority ?? alert?.severity ?? null;

export const getWorkflowStatusLabel = (
  status?: string | null,
  language: SupportedLanguage = "en",
): string => getPresentationStatusLabel(status, language);

export const getConfidencePercentage = (confidence?: number | null): number | null => {
  if (confidence === null || confidence === undefined || !Number.isFinite(confidence)) {
    return null;
  }
  return Math.round(Math.max(0, Math.min(1, confidence)) * 100);
};
