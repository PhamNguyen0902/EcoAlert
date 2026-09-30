import {
  analyzeIncidentWithOpenRouter,
  type IncidentAnalysisResult,
  type VisionDetectionSummary,
} from './openrouter.service';

export type VisionBoundingBox = [number, number, number, number];

export interface VisionDetectionInput {
  materialClass: string;
  confidence: number;
  bbox?: VisionBoundingBox;
}

export interface VisionIncidentAnalysisInput {
  title?: string;
  description: string;
  imageUrl: string;
  detections: VisionDetectionInput[];
}

// giới hạn độ tin cậy trong khoảng từ không đến một
const clampConfidence = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

// tổng hợp danh sách đối tượng phát hiện được và tính độ tin cậy trung bình theo từng nhóm
export const buildVisionDetectionSummary = (
  detections: VisionDetectionInput[],
): VisionDetectionSummary => {
  const groups = new Map<
    string,
    { count: number; confidenceTotal: number }
  >();

  let confidenceTotal = 0;
  let validCount = 0;

  for (const detection of detections) {
    const materialClass = detection.materialClass?.trim();
    if (!materialClass) continue;

    const confidence = clampConfidence(detection.confidence);
    confidenceTotal += confidence;
    validCount += 1;

    const current = groups.get(materialClass) ?? {
      count: 0,
      confidenceTotal: 0,
    };

    groups.set(materialClass, {
      count: current.count + 1,
      confidenceTotal: current.confidenceTotal + confidence,
    });
  }

  const classes = Array.from(groups.entries())
    .map(([materialClass, value]) => ({
      materialClass,
      count: value.count,
      averageConfidence:
        value.count > 0 ? value.confidenceTotal / value.count : 0,
    }))
    .sort(
      (a, b) =>
        b.count - a.count || b.averageConfidence - a.averageConfidence,
    );

  return {
    objectCount: validCount,
    dominantClass: classes[0]?.materialClass,
    averageConfidence:
      validCount > 0 ? confidenceTotal / validCount : undefined,
    classes,
  };
};

// kết hợp kết quả nhận diện của yolo với openrouter vision để phân tích chi tiết sự cố
export const analyzeVisionIncident = async (
  input: VisionIncidentAnalysisInput,
): Promise<IncidentAnalysisResult> => {
  const visionSummary = buildVisionDetectionSummary(input.detections);

  return analyzeIncidentWithOpenRouter({
    title: input.title,
    description: input.description,
    imageUrl: input.imageUrl,
    visionSummary,
  });
};
