import React from "react";
import { EvidenceImageFrame } from "../../../shared/components/media/EvidenceImageFrame";

// ưu tiên hiển thị ảnh đã gắn thông tin ngày giờ và tọa độ, nếu lỗi thì hiển thị ảnh gốc
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
