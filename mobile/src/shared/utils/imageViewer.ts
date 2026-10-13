export const MIN_IMAGE_ZOOM = 1;
export const MAX_IMAGE_ZOOM = 4;

export interface ViewerSize {
  width: number;
  height: number;
}

export function clampImageZoom(value: number) {
  "worklet";
  return Number.isFinite(value)
    ? Math.max(MIN_IMAGE_ZOOM, Math.min(MAX_IMAGE_ZOOM, value))
    : MIN_IMAGE_ZOOM;
}

/** Bounds are viewport pixels, based on the fitted image, not its letterboxed container. */
export function calculateImagePanBounds(
  image: ViewerSize,
  viewport: ViewerSize,
  zoom: number,
) {
  "worklet";
  if (
    ![image.width, image.height, viewport.width, viewport.height].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  )
    return { x: 0, y: 0 };
  const scale = clampImageZoom(zoom);
  return {
    x: scale <= 1 ? 0 : Math.max(0, (image.width * scale - viewport.width) / 2),
    y:
      scale <= 1
        ? 0
        : Math.max(0, (image.height * scale - viewport.height) / 2),
  };
}

export function clampImagePan(value: number, limit: number) {
  "worklet";
  if (!Number.isFinite(value) || !Number.isFinite(limit) || limit <= 0)
    return 0;
  return Math.max(-limit, Math.min(limit, value));
}

export function getDoubleTapImageZoom(current: number) {
  "worklet";
  return clampImageZoom(current) <= 1.1 ? 2.5 : 1;
}
