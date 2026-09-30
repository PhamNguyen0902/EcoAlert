import type { Alert } from "@/types";
import { EnvironmentalAiAnalysisContent } from "./VisionAnalysisTestPanel";

interface EnvironmentalAiAnalysisProps {
  alert: Alert;
}

// hiển thị kết quả phân tích sự cố và minh chứng nhận diện yolo ở chế độ chỉ đọc
export function EnvironmentalAiAnalysis({ alert }: EnvironmentalAiAnalysisProps) {
  return <EnvironmentalAiAnalysisContent alert={alert} />;
}
