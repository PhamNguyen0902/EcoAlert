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

const clampConfidence = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

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

/**
 * Kết hợp YOLO detection với OpenRouter Vision.
 *
 * - YOLO chịu trách nhiệm nhận diện class/bounding box.
 * - OpenRouter quan sát toàn cảnh ảnh và dùng YOLO summary như tín hiệu hỗ trợ.
 * - Không tính khối lượng bằng số detection nhân trọng lượng cố định.
 */
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
