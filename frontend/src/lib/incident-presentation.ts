import type { Language } from '@/contexts/LanguageContext';

type PresentationLanguage = Language;
const labels = {
  vi: {
    category: { illegal_dumping: 'Xả rác không đúng nơi quy định', water_pollution: 'Ô nhiễm nguồn nước', air_pollution: 'Ô nhiễm không khí', illegal_burning: 'Đốt rác trái phép', flooding: 'Ngập nước', fallen_tree: 'Cây ngã hoặc đổ', illegal_construction_waste: 'Đổ chất thải xây dựng trái phép', noise_pollution: 'Ô nhiễm tiếng ồn', soil_contamination: 'Ô nhiễm đất', wildlife_threat: 'Đe dọa động vật hoang dã', other: 'Khác', unclassified: 'Chưa phân loại' },
    severity: { low: 'Thấp', medium: 'Trung bình', high: 'Cao', critical: 'Nghiêm trọng' },
    status: { pending: 'Chờ xử lý', ai_analyzing: 'AI đang phân tích', verified: 'Đã xác minh', assigned: 'Đã phân công', in_progress: 'Đang xử lý', resolved: 'Đã giải quyết', closed: 'Đã đóng', rejected: 'Đã từ chối', unknown: 'Không rõ trạng thái' },
    confidenceTier: { high_confidence: 'Độ tin cậy cao', review_required: 'Cần xác nhận', unclassified: 'Chưa phân loại' }, unavailable: 'Không có', notDetermined: 'Chưa xác định',
  },
  en: {
    category: { illegal_dumping: 'Illegal dumping', water_pollution: 'Water pollution', air_pollution: 'Air pollution', illegal_burning: 'Illegal burning', flooding: 'Flooding', fallen_tree: 'Fallen tree', illegal_construction_waste: 'Illegal construction waste', noise_pollution: 'Noise pollution', soil_contamination: 'Soil contamination', wildlife_threat: 'Wildlife threat', other: 'Other', unclassified: 'Unclassified' },
    severity: { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' },
    status: { pending: 'Pending', ai_analyzing: 'AI analyzing', verified: 'Verified', assigned: 'Assigned', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed', rejected: 'Rejected', unknown: 'Unknown status' },
    confidenceTier: { high_confidence: 'High confidence', review_required: 'Review required', unclassified: 'Unclassified' }, unavailable: 'Not available', notDetermined: 'Not determined',
  },
} as const;
const normalize = (value?: string | null) => value?.trim().toLowerCase().replace(/[\s-]+/g, '_') ?? '';
const humanize = (value?: string | null, fallback = '') => value ? value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : fallback;
const labelFor = (group: keyof typeof labels.vi, value: string | null | undefined, language: PresentationLanguage, fallback: string) =>
  (labels[language][group] as Record<string, string>)[normalize(value)] ?? humanize(value, fallback);

export const getIncidentCategoryLabel = (value?: string | null, language: PresentationLanguage = 'vi') => labelFor('category', value, language, labels[language].category.unclassified);
export const getIncidentSeverityLabel = (value?: string | null, language: PresentationLanguage = 'vi') => labelFor('severity', value, language, labels[language].unavailable);
export const getIncidentStatusLabel = (value?: string | null, language: PresentationLanguage = 'vi') => labelFor('status', value, language, labels[language].status.unknown);
export const getConfidenceTierLabel = (value?: string | null, language: PresentationLanguage = 'vi') => labelFor('confidenceTier', value, language, labels[language].notDetermined);
export const getPresentationCopy = (language: PresentationLanguage = 'vi') => labels[language];
