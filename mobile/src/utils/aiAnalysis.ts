import type { Alert, AlertCategory, Severity } from "../types";

export const AI_POLL_INTERVAL_MS = 3_000;
export const AI_PENDING_WINDOW_MS = 60_000;

export type AiAnalysisState = "PENDING" | "COMPLETED" | "FAILED" | "UNAVAILABLE";

type SupportedLanguage = "en" | "vi";

const CATEGORY_LABELS: Record<string, Record<SupportedLanguage, string>> = {
  illegal_dumping: { en: "Illegal Dumping", vi: "Đổ rác trái phép" },
  water_pollution: { en: "Water Pollution", vi: "Ô nhiễm nước" },
  air_pollution: { en: "Air Pollution", vi: "Ô nhiễm không khí" },
  illegal_burning: { en: "Illegal Burning", vi: "Đốt chất thải trái phép" },
  flooding: { en: "Flooding", vi: "Ngập lụt" },
  fallen_tree: { en: "Fallen Tree", vi: "Cây đổ" },
  illegal_construction_waste: { en: "Construction Waste", vi: "Phế thải xây dựng" },
  noise_pollution: { en: "Noise Pollution", vi: "Ô nhiễm tiếng ồn" },
  soil_contamination: { en: "Soil Contamination", vi: "Ô nhiễm đất" },
  wildlife_threat: { en: "Wildlife Threat", vi: "Đe dọa động vật hoang dã" },
  other: { en: "Other Environmental Incident", vi: "Sự cố môi trường khác" },
};

const WORKFLOW_STATUS_LABELS: Record<string, Record<SupportedLanguage, string>> = {
  pending: { en: "Pending", vi: "Chờ xử lý" },
  ai_analyzing: { en: "Pending review", vi: "Chờ duyệt" },
  verified: { en: "Verified", vi: "Đã xác minh" },
  assigned: { en: "Assigned", vi: "Đã phân công" },
  in_progress: { en: "In progress", vi: "Đang xử lý" },
  resolved: { en: "Resolved", vi: "Đã giải quyết" },
  closed: { en: "Closed", vi: "Đã đóng" },
  rejected: { en: "Rejected", vi: "Đã từ chối" },
};

const normalizedCategory = (category?: AlertCategory | null): string =>
  typeof category === "string" ? category.trim().toLowerCase() : "";

export const hasCompletedAiClassification = (alert?: Alert | null): boolean => {
  if (!alert?.aiAnalysisId && !alert?.aiAnalyzedAt) return false;
  const category = normalizedCategory(alert.category);
  return Boolean(category && category !== "unclassified" && alert.severity);
};

export const getAiAnalysisState = (
  alert?: Alert | null,
  now = Date.now(),
): AiAnalysisState => {
  if (!alert) return "UNAVAILABLE";

  const hasAnalysisMarker = Boolean(alert.aiAnalysisId || alert.aiAnalyzedAt);
  if (hasAnalysisMarker) {
    return hasCompletedAiClassification(alert) ? "COMPLETED" : "FAILED";
  }

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
): string => {
  const normalized = normalizedCategory(category);
  const knownLabel = CATEGORY_LABELS[normalized]?.[language];
  if (knownLabel) return knownLabel;
  if (!normalized || normalized === "unclassified") {
    return language === "vi" ? "Chưa phân loại" : "Not classified";
  }

  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export const getSeverityLabel = (severity?: Severity | null): string =>
  severity?.toUpperCase() || "—";

export const getWorkflowStatusLabel = (
  status?: string | null,
  language: SupportedLanguage = "en",
): string => {
  const normalized = status?.trim().toLowerCase() || "pending";
  return WORKFLOW_STATUS_LABELS[normalized]?.[language] || normalized.replace(/_/g, " ").toUpperCase();
};

export const getConfidencePercentage = (confidence?: number | null): number | null => {
  if (confidence === null || confidence === undefined || !Number.isFinite(confidence)) {
    return null;
  }
  return Math.round(Math.max(0, Math.min(1, confidence)) * 100);
};
