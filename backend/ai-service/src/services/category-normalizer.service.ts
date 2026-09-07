import { AlertCategory, Severity } from '@ecoalert/shared';

export const UNCLASSIFIED_CATEGORY = 'UNCLASSIFIED' as const;
export type ClassifiedAlertCategory = AlertCategory | typeof UNCLASSIFIED_CATEGORY;

const normalized = (value: string) => value
  .trim()
  .toLocaleLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[\s\-]+/g, '_');

  // Bản đồ các tên danh mục cảnh báo không chuẩn sang các danh mục chuẩn
const categoryAliases: Record<string, AlertCategory | typeof UNCLASSIFIED_CATEGORY> = {
  illegal_dumping: AlertCategory.ILLEGAL_DUMPING,
  illegal_dump: AlertCategory.ILLEGAL_DUMPING,
  waste: AlertCategory.ILLEGAL_DUMPING,
  garbage: AlertCategory.ILLEGAL_DUMPING,
  litter: AlertCategory.ILLEGAL_DUMPING,
  rac_thai: AlertCategory.ILLEGAL_DUMPING,
  water_pollution: AlertCategory.WATER_POLLUTION,
  water_contamination: AlertCategory.WATER_POLLUTION,
  air_pollution: AlertCategory.AIR_POLLUTION,
  illegal_burning: AlertCategory.ILLEGAL_BURNING,
  burning_waste: AlertCategory.ILLEGAL_BURNING,
  flooding: AlertCategory.FLOODING,
  flood: AlertCategory.FLOODING,
  fallen_tree: AlertCategory.FALLEN_TREE,
  illegal_construction_waste: AlertCategory.ILLEGAL_CONSTRUCTION_WASTE,
  construction_waste: AlertCategory.ILLEGAL_CONSTRUCTION_WASTE,
  noise_pollution: AlertCategory.NOISE_POLLUTION,
  soil_contamination: AlertCategory.SOIL_CONTAMINATION,
  wildlife_threat: AlertCategory.WILDLIFE_THREAT,
  other: AlertCategory.OTHER,
  unclassified: UNCLASSIFIED_CATEGORY,
  unknown: UNCLASSIFIED_CATEGORY,
  insufficient_evidence: UNCLASSIFIED_CATEGORY,
};
 // Bản đồ các tên mức độ nghiêm trọng không chuẩn sang các mức độ chuẩn
const severityAliases: Record<string, Severity> = {
  low: Severity.LOW,
  medium: Severity.MEDIUM,
  moderate: Severity.MEDIUM,
  high: Severity.HIGH,
  critical: Severity.CRITICAL,
};
 // Chuẩn hóa danh mục cảnh báo và mức độ nghiêm trọng từ dữ liệu đầu vào
export const normalizeIncidentCategory = (value: unknown): ClassifiedAlertCategory => {
  if (typeof value !== 'string') return UNCLASSIFIED_CATEGORY;
  return categoryAliases[normalized(value)] || UNCLASSIFIED_CATEGORY;
};
  // Chuẩn hóa mức độ nghiêm trọng từ dữ liệu đầu vào
export const normalizeIncidentSeverity = (value: unknown): Severity | undefined =>
  typeof value === 'string' ? severityAliases[normalized(value)] : undefined; 

  // Kiểm tra xem giá trị có phải là danh mục cảnh báo chuẩn hay không
export const isCanonicalAlertCategory = (value: unknown): value is AlertCategory =>
  typeof value === 'string' && Object.values(AlertCategory).includes(value as AlertCategory);
