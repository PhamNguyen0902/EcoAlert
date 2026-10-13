import React from "react";
import { EvidenceImageFrame } from "../../../components/media/EvidenceImageFrame";

/** Confirmation shows the watermarked rendition, preserving the original fallback. */
export const ReportEvidenceImage = (props: {
  imageUri: string;
  fallbackUri: string;
  onPress?: (renderedUri: string) => void;
  overlay?: React.ReactNode;
}) => (
  <EvidenceImageFrame
    {...props}
    accessibilityLabel="Ảnh hiện trường gửi kèm báo cáo"
  />
);
