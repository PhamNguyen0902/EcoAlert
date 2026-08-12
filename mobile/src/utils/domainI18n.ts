import type { Language } from "../context/LanguageContext";

type LocalizedText = Record<Language, string>;
export type LocalizedAiText = Partial<Record<Language, string | null>>;
const labels = (vi: string, en: string): LocalizedText => ({ vi, en });
const normalize = (value?: string | null) => value?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? "";
const readableFallback = (value?: string | null) => normalize(value).split("_").filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") || undefined;
function present(language: Language, values: Record<string, LocalizedText>, value?: string | null, fallback?: LocalizedText) {
  return values[normalize(value)]?.[language] ?? fallback?.[language] ?? readableFallback(value) ?? labels("Chưa xác định", "Unavailable")[language];
}

const status = {
  pending: labels("Chờ xác minh", "Pending"), ai_analyzing: labels("Đang phân tích AI", "AI analysis in progress"),
  verified: labels("Đã xác minh", "Verified"), assigned: labels("Đã phân công", "Assigned"),
  in_progress: labels("Đang xử lý", "In Progress"), resolved: labels("Đã xử lý", "Resolved"),
  closed: labels("Đã đóng", "Closed"), rejected: labels("Đã từ chối", "Rejected"),
} satisfies Record<string, LocalizedText>;
const severity = {
  low: labels("Thấp", "Low"), medium: labels("Trung bình", "Medium"), high: labels("Cao", "High"), critical: labels("Nghiêm trọng", "Critical"),
} satisfies Record<string, LocalizedText>;
const category = {
  illegal_dumping: labels("Đổ rác trái phép", "Illegal Dumping"), water_pollution: labels("Ô nhiễm nước", "Water Pollution"),
  air_pollution: labels("Ô nhiễm không khí", "Air Pollution"), illegal_burning: labels("Đốt chất thải trái phép", "Illegal Burning"),
  flooding: labels("Ngập lụt", "Flooding"), fallen_tree: labels("Cây đổ", "Fallen Tree"),
  illegal_construction_waste: labels("Phế thải xây dựng", "Construction Waste"), noise_pollution: labels("Ô nhiễm tiếng ồn", "Noise Pollution"),
  soil_contamination: labels("Ô nhiễm đất", "Soil Contamination"), wildlife_threat: labels("Đe dọa động vật hoang dã", "Wildlife Threat"),
  other: labels("Sự cố môi trường khác", "Other Environmental Incident"), unclassified: labels("Chưa phân loại", "Unclassified"),
} satisfies Record<string, LocalizedText>;
const analysisMode = {
  full_multimodal: labels("Phân tích đa phương thức đầy đủ", "Full Multimodal"), semantic_only: labels("Chỉ phân tích ngữ nghĩa", "Semantic Only"),
  vision_only: labels("Chỉ phân tích hình ảnh", "Vision Only"), failed: labels("Phân tích thất bại", "Analysis Failed"),
  completed: labels("Đã hoàn tất", "Completed"), skipped: labels("Đã bỏ qua", "Skipped"), unavailable: labels("Không khả dụng", "Unavailable"),
} satisfies Record<string, LocalizedText>;
const confidenceSource = { fusion: labels("Tổng hợp AI", "Fusion"), category: labels("Phân loại", "Category"), semantic: labels("Phân tích ngữ nghĩa", "Semantic"), none: labels("Không có", "None") } satisfies Record<string, LocalizedText>;
const visionSupport = { strong: labels("Mạnh", "Strong"), partial: labels("Một phần", "Partial"), none: labels("Không có", "None"), not_applicable: labels("Không áp dụng", "Not applicable") } satisfies Record<string, LocalizedText>;
const classificationStatus = { ai_suggested: labels("AI đề xuất", "AI Suggested"), unclassified: labels("Chưa phân loại", "Unclassified"), high_confidence: labels("Độ tin cậy cao", "High Confidence"), review_required: labels("Cần xác nhận", "Review Required") } satisfies Record<string, LocalizedText>;
const visionObject = {
  plastic_bottle: labels("Chai nhựa", "Plastic Bottle"), plastic_bag: labels("Túi nhựa", "Plastic Bag"), plastic_cup: labels("Cốc nhựa", "Plastic Cup"),
  metal_can: labels("Lon kim loại", "Metal Can"), cardboard: labels("Bìa carton", "Cardboard"), glass_bottle: labels("Chai thủy tinh", "Glass Bottle"),
  plastic_waste: labels("Rác nhựa", "Plastic Waste"), organic_waste: labels("Rác hữu cơ", "Organic Waste"), construction_waste: labels("Chất thải xây dựng", "Construction Waste"), hazardous_waste: labels("Chất thải nguy hại", "Hazardous Waste"),
  metal_waste: labels("Rác kim loại", "Metal Waste"), glass_waste: labels("Rác thủy tinh", "Glass Waste"), paper_waste: labels("Rác giấy", "Paper Waste"), e_waste: labels("Rác điện tử", "Electronic Waste"), mixed_waste: labels("Rác hỗn hợp", "Mixed Waste"), other: labels("Khác", "Other"),
} satisfies Record<string, LocalizedText>;
const timelineEvent = {
  incident_reported: labels("Đã gửi báo cáo sự cố", "Incident reported"), ai_analysis_started: labels("Đã bắt đầu phân tích AI", "AI analysis started"),
  ai_analysis_completed: labels("Đã hoàn tất phân tích AI", "AI analysis completed"), status_changed: labels("Đã cập nhật trạng thái", "Status updated"),
  incident_verified: labels("Đã xác minh sự cố", "Incident verified"), incident_assigned: labels("Đã phân công sự cố", "Incident assigned"),
  processing_started: labels("Đã bắt đầu xử lý", "Processing started"), officer_arrived: labels("Cán bộ đã đến hiện trường", "Officer arrived on site"),
  evidence_uploaded: labels("Đã tải lên bằng chứng", "Evidence uploaded"), incident_resolved: labels("Đã xử lý sự cố", "Incident resolved"), incident_closed: labels("Đã đóng sự cố", "Incident closed"),
} satisfies Record<string, LocalizedText>;
const weatherCondition = { clear: labels("Trời quang", "Clear"), clouds: labels("Có mây", "Cloudy"), rain: labels("Mưa", "Rain"), drizzle: labels("Mưa phùn", "Drizzle"), thunderstorm: labels("Dông", "Thunderstorm"), snow: labels("Tuyết", "Snow"), mist: labels("Sương mù", "Mist"), fog: labels("Sương mù", "Fog"), haze: labels("Mù khô", "Haze"), smoke: labels("Khói", "Smoke") } satisfies Record<string, LocalizedText>;
const actorRole = { system: labels("Hệ thống", "System"), citizen: labels("Người dân", "Citizen"), officer: labels("Cán bộ", "Officer"), admin: labels("Quản trị viên", "Administrator") } satisfies Record<string, LocalizedText>;

export const getStatusDisplay = (language: Language, value?: string | null) => present(language, status, value, labels("Chưa xác định", "Unavailable"));
export const getSeverityDisplay = (language: Language, value?: string | null) => present(language, severity, value, labels("Chưa xác định", "Unavailable"));
export const getCategoryDisplay = (language: Language, value?: string | null) => present(language, category, value, category.unclassified);
export const getAnalysisModeDisplay = (language: Language, value?: string | null) => present(language, analysisMode, value, labels("Chưa xác định", "Unavailable"));
export const getConfidenceSourceDisplay = (language: Language, value?: string | null) => present(language, confidenceSource, value, labels("Không có", "None"));
export const getVisionSupportDisplay = (language: Language, value?: string | null) => present(language, visionSupport, value, labels("Không áp dụng", "Not applicable"));
export const getClassificationDisplay = (language: Language, value?: string | null) => present(language, classificationStatus, value, labels("Chưa phân loại", "Unclassified"));
export const getVisionObjectDisplay = (language: Language, value?: string | null) => present(language, visionObject, value, labels("Chưa xác định", "Not determined"));
export const getTimelineEventDisplay = (language: Language, value?: string | null) => present(language, timelineEvent, value, labels("Sự kiện hệ thống", "System event"));
export const isKnownTimelineEvent = (value?: string | null) => Boolean((timelineEvent as Record<string, LocalizedText>)[normalize(value)]);
export const getActorRoleDisplay = (language: Language, value?: string | null) => present(language, actorRole, value, labels("Người dùng", "User"));
export const getWeatherConditionDisplay = (language: Language, value?: string | null) => {
  const normalized = normalize(value); const key = Object.keys(weatherCondition).find((candidate) => normalized.includes(candidate));
  return key ? (weatherCondition as Record<string, LocalizedText>)[key][language] : labels("Điều kiện thời tiết", "Weather conditions")[language];
};
/** Selects persisted public AI prose for the active locale; legacy text is the final compatibility fallback. */
export const resolveLocalizedAiText = (localized: LocalizedAiText | null | undefined, legacy: string | null | undefined, language: Language) =>
  localized?.[language]?.trim() || legacy?.trim() || "";
