/** Pixel coordinates are relative to the original image, never its watermarked rendition. */
export interface ImageSize {
  width: number;
  height: number;
}
export interface ContainedImageRect extends ImageSize {
  scale: number;
  offsetX: number;
  offsetY: number;
}
export interface ScreenBoundingBox extends ImageSize {
  left: number;
  top: number;
}
export interface DetectionSummaryInput {
  materialClass: string;
  confidence?: number;
  count?: number;
}

const validSize = ({ width, height }: ImageSize) =>
  Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

export function calculateContainedImageRect(
  original: ImageSize,
  container: ImageSize,
): ContainedImageRect | null {
  if (!validSize(original) || !validSize(container)) return null;
  const scale = Math.min(
    container.width / original.width,
    container.height / original.height,
  );
  const width = original.width * scale;
  const height = original.height * scale;
  if (!Number.isFinite(scale) || scale <= 0 || !validSize({ width, height }))
    return null;
  return {
    scale,
    width,
    height,
    offsetX: (container.width - width) / 2,
    offsetY: (container.height - height) / 2,
  };
}

export function transformBoundingBox(
  bbox: unknown,
  original: ImageSize,
  rect: ContainedImageRect,
): ScreenBoundingBox | null {
  if (
    !validSize(original) ||
    !validSize(rect) ||
    !Number.isFinite(rect.scale) ||
    rect.scale <= 0 ||
    !Number.isFinite(rect.offsetX) ||
    !Number.isFinite(rect.offsetY) ||
    !Array.isArray(bbox) ||
    bbox.length !== 4 ||
    !bbox.every((value) => typeof value === "number" && Number.isFinite(value))
  )
    return null;
  const [x1, y1, x2, y2] = bbox as number[];
  if (x2 <= x1 || y2 <= y1) return null;
  const left = clamp(x1, 0, original.width);
  const top = clamp(y1, 0, original.height);
  const right = clamp(x2, 0, original.width);
  const bottom = clamp(y2, 0, original.height);
  if (right <= left || bottom <= top) return null;
  const transformed = {
    left: rect.offsetX + left * rect.scale,
    top: rect.offsetY + top * rect.scale,
    width: (right - left) * rect.scale,
    height: (bottom - top) * rect.scale,
  };
  return validSize(transformed) &&
    Object.values(transformed).every(Number.isFinite)
    ? transformed
    : null;
}

/** Keep labels above their boxes when possible; otherwise inside the top edge. */
export function positionDetectionLabel(
  box: ScreenBoundingBox,
  label: ImageSize,
  rect: ContainedImageRect,
) {
  const width = Math.min(label.width, rect.width);
  const height = Math.min(label.height, rect.height);
  const preferredTop = box.top - height - 2;
  return {
    left: clamp(box.left, rect.offsetX, rect.offsetX + rect.width - width),
    top: clamp(
      preferredTop >= rect.offsetY ? preferredTop : box.top,
      rect.offsetY,
      rect.offsetY + rect.height - height,
    ),
    width,
  };
}

export function formatDetectionConfidence(confidence?: number): string | null {
  return typeof confidence === "number" &&
    Number.isFinite(confidence) &&
    confidence >= 0 &&
    confidence <= 1
    ? `${Math.round(confidence * 100)}%`
    : null;
}

export function groupDetectionsByClass(
  detections: readonly DetectionSummaryInput[],
) {
  const groups = new Map<
    string,
    { materialClass: string; count: number; maxConfidence: number | null }
  >();
  detections.forEach((item) => {
    const group = groups.get(item.materialClass) ?? {
      materialClass: item.materialClass,
      count: 0,
      maxConfidence: null,
    };
    const count =
      item.count !== undefined && Number.isInteger(item.count) && item.count > 0
        ? item.count
        : 1;
    group.count += count;
    if (formatDetectionConfidence(item.confidence) !== null) {
      group.maxConfidence = Math.max(
        group.maxConfidence ?? 0,
        item.confidence!,
      );
    }
    groups.set(item.materialClass, group);
  });
  return [...groups.values()];
}

// Existing mobile labels, plus plastic_cup/metal_can from vision-service's actual six classes.
const MATERIAL_LABELS: Readonly<Record<string, string>> = {
  plastic_bag: "Túi nhựa",
  plastic_bottle: "Chai nhựa",
  plastic_cup: "Cốc nhựa",
  metal_can: "Lon kim loại",
  glass_bottle: "Chai thủy tinh",
  cardboard: "Bìa carton",
  paper: "Giấy",
  metal: "Kim loại",
  organic_waste: "Rác hữu cơ",
  construction_waste: "Phế thải xây dựng",
  styrofoam: "Xốp",
  household_waste: "Rác sinh hoạt",
};
export const getWasteDetectionLabel = (materialClass: string) =>
  MATERIAL_LABELS[materialClass] ?? materialClass;

/** Exact URL match deliberately preserves paths/query strings; no index or displayUrl fallback. */
export function matchVisionEvidence<T extends { imageUrl: string }>(
  originalUrls: readonly string[],
  evidence: readonly T[],
) {
  return [...new Set(originalUrls)].flatMap((url) => {
    const match = evidence.find((item) => item.imageUrl === url);
    return match ? [match] : [];
  });
}
