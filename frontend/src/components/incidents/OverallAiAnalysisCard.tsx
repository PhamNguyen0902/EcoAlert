import { BrainCircuit } from "lucide-react";
import type { Alert } from "@/types";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getConfidenceTierLabel,
  getIncidentCategoryLabel,
  getIncidentSeverityLabel,
  getPresentationCopy,
} from "@/lib/incident-presentation";

const percentage = (value: number | null | undefined, unavailable: string) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? unavailable
    : `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

/** Shows the direct OpenRouter incident interpretation, always as human-review guidance. */
export function OverallAiAnalysisCard({ alert }: { alert: Alert }) {
  const { language } = useLanguage();
  const presentation = getPresentationCopy(language);
  const text =
    language === "vi"
      ? {
          title: "AI phân tích tổng quan",
          subtitle: "Diễn giải từ ảnh và báo cáo; cần con người xác nhận.",
          unavailable:
            alert.aiFailureReason ||
            "Dịch vụ phân tích AI tạm thời không khả dụng.",
          shortReason: "Lý do ngắn:",
          category: "Danh mục AI gợi ý",
          confidence: "Độ tin cậy",
          severity: "Mức độ",
          incident: "Khả năng là sự cố môi trường",
          likely: "Có khả năng",
          insufficient: "Chưa đủ bằng chứng",
        }
      : {
          title: "Overall AI analysis",
          subtitle:
            "Interprets the image and report; human confirmation is required.",
          unavailable:
            alert.aiFailureReason || "AI analysis is temporarily unavailable.",
          shortReason: "Short reason:",
          category: "AI suggested category",
          confidence: "Confidence",
          severity: "Severity",
          incident: "Environmental-incident likelihood",
          likely: "Likely",
          insufficient: "Insufficient evidence",
        };
  const analysis = alert.aiOverallAnalysis;
  if (!analysis) {
    if (alert.aiAnalysisMode !== "FAILED") return null;
    return (
      <section
        className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-5"
        aria-labelledby="overall-ai-analysis-heading"
      >
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-5 w-5 text-amber-600" />
          <h3
            id="overall-ai-analysis-heading"
            className="text-base font-semibold"
          >
            {text.title}
          </h3>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {text.unavailable}
        </p>
      </section>
    );
  }
  return (
    <section
      className="rounded-lg border border-primary/20 bg-primary/5 p-5"
      aria-labelledby="overall-ai-analysis-heading"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-5 w-5 text-primary" />
          <div>
            <h3
              id="overall-ai-analysis-heading"
              className="text-base font-semibold"
            >
              {text.title}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {text.subtitle}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          {getConfidenceTierLabel(analysis.confidenceTier, language)}
        </span>
      </div>
      <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-foreground sm:text-base">
        {analysis.overallSummary}
      </p>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
        <strong>{text.shortReason}</strong> {analysis.shortReason}
      </p>
      <dl className="mt-5 grid gap-4 rounded-md border bg-background/70 p-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">{text.category}</dt>
          <dd className="mt-1 break-words font-semibold">
            {getIncidentCategoryLabel(analysis.categorySuggestion, language)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{text.confidence}</dt>
          <dd className="mt-1 font-semibold">
            {percentage(analysis.categoryConfidence, presentation.unavailable)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{text.severity}</dt>
          <dd className="mt-1 break-words font-semibold">
            {getIncidentSeverityLabel(analysis.severity, language)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{text.incident}</dt>
          <dd className="mt-1 font-semibold">
            {analysis.isIncident ? text.likely : text.insufficient}
          </dd>
        </div>
      </dl>
    </section>
  );
}
