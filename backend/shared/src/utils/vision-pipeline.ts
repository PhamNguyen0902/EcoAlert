import { AlertCategory } from '../enums';

export type VisionPipeline = 'WASTE_DETECTION' | 'SEMANTIC_ONLY';

const WASTE_CATEGORIES = new Set<AlertCategory>([
  AlertCategory.ILLEGAL_DUMPING,
  AlertCategory.ILLEGAL_CONSTRUCTION_WASTE,
]);

// kiểm tra sự cố có thuộc danh mục rác thải hay không
export const isWasteRelatedCategory = (
  category: AlertCategory | 'UNCLASSIFIED' | null | undefined,
): boolean => Boolean(category && category !== 'UNCLASSIFIED' && WASTE_CATEGORIES.has(category));

// xác định luồng xử lý thị giác phù hợp theo danh mục sự cố
export const resolveVisionPipeline = (
  category: AlertCategory | 'UNCLASSIFIED' | null | undefined,
): VisionPipeline => isWasteRelatedCategory(category) ? 'WASTE_DETECTION' : 'SEMANTIC_ONLY';
