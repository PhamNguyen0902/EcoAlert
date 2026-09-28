import type { Alert } from "@/types";
import { EnvironmentalAiAnalysisContent } from "./VisionAnalysisTestPanel";

// A read-only component for displaying environmental AI analysis results based on an alert.

interface EnvironmentalAiAnalysisProps {
  alert: Alert;
}

/** Read-only report-level OpenRouter and YOLO evidence; no upload or re-analysis controls. */
export function EnvironmentalAiAnalysis({ alert }: EnvironmentalAiAnalysisProps) {
  return <EnvironmentalAiAnalysisContent alert={alert} />;
}
