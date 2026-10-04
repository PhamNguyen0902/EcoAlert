import React, { useMemo } from "react";
import type { WasteDetectionDraft } from "../types";
import { WasteDetectionResults } from "../../../components/vision/WasteDetectionResults";

/** Groups actual detections for display; no changes to draft data or submitted results. */
export const WasteDetectionChips = ({
  detections,
  showCount = false,
}: {
  detections: WasteDetectionDraft[];
  showCount?: boolean;
}) => {
  const results = useMemo(
    () =>
      detections.map((item) => ({
        materialClass: item.label,
        count: item.count,
        confidence: item.confidence,
      })),
    [detections],
  );
  return <WasteDetectionResults detections={results} showCount={showCount} />;
};
