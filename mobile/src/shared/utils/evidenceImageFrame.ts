/** Display-only sizing. Never use this to resize/crop the captured or Vision image. */
export const EVIDENCE_FRAME_ASPECT_RATIO = 3 / 4;
export const EVIDENCE_FRAME_WIDTH = "84%" as const;
export const EVIDENCE_FRAME_MAX_WIDTH = 320;

export function calculateEvidenceFrameSize(availableWidth: number) {
  const width = Number.isFinite(availableWidth)
    ? Math.min(Math.max(0, availableWidth) * 0.84, EVIDENCE_FRAME_MAX_WIDTH)
    : 0;
  return { width, height: width / EVIDENCE_FRAME_ASPECT_RATIO };
}
