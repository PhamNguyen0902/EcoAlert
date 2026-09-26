import type { Alert } from "@/types";
import { EnvironmentalAiAnalysisContent } from "./VisionAnalysisTestPanel";

interface EnvironmentalAiAnalysisProps {
  alert: Alert;
}

/** Read-only report-level OpenRouter and YOLO evidence; no upload or re-analysis controls. */
export function EnvironmentalAiAnalysis({ alert }: EnvironmentalAiAnalysisProps) {
  return <EnvironmentalAiAnalysisContent alert={alert} />;
}
