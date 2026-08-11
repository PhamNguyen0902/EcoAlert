import { IAiVisionAnalysis } from '@ecoalert/shared';

export interface CompactVisionObjectEvidence {
  type: string;
  count: number;
  maxConfidence: number;
}

export interface CompactVisionEvidence {
  detectorAvailable: boolean;
  model: string | null;
  totalObjects: number;
  objects: CompactVisionObjectEvidence[];
  detectorConfidence: number | null;
}

export const buildCompactVisionEvidence = (
  vision?: IAiVisionAnalysis,
): CompactVisionEvidence => {
  const detectorAvailable = vision?.status === 'COMPLETED';
  if (!detectorAvailable) {
    return {
      detectorAvailable: false,
      model: vision?.detectorModel || null,
      totalObjects: 0,
      objects: [],
      detectorConfidence: null,
    };
  }

  const grouped = new Map<string, CompactVisionObjectEvidence>();
  for (const detection of vision.detections || []) {
    const current = grouped.get(detection.label);
    if (current) {
      current.count += 1;
      current.maxConfidence = Math.max(current.maxConfidence, detection.confidence);
    } else {
      grouped.set(detection.label, {
        type: detection.label,
        count: 1,
        maxConfidence: detection.confidence,
      });
    }
  }
  return {
    detectorAvailable: true,
    model: vision.detectorModel,
    totalObjects: vision.totalDetectedObjects,
    objects: [...grouped.values()].sort((left, right) => right.count - left.count || right.maxConfidence - left.maxConfidence),
    detectorConfidence: vision.detectorConfidence,
  };
};

export const formatVisionEvidenceLines = (evidence: CompactVisionEvidence): string[] =>
  evidence.objects.map((item) => `${item.type} × ${item.count} (max ${Math.round(item.maxConfidence * 100)}%)`);
