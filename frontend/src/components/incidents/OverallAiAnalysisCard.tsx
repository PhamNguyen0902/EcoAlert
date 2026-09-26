import {
  AlertCircle,
  BrainCircuit,
  CheckCircle2,
  FileText,
  ShieldCheck,
} from "lucide-react";
import type { Alert } from "@/types";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getConfidenceTierLabel,
  getIncidentCategoryLabel,
  getIncidentSeverityLabel,
  getPresentationCopy,
} from "@/lib/incident-presentation";

const toPercentValue = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  return Math.round(Math.max(0, Math.min(1, value)) * 100);
};

export function OverallAiAnalysisCard({ alert }: { alert: Alert }) {
  const { language } = useLanguage();
  const presentation = getPresentationCopy(language);
  const analysis = alert.aiOverallAnalysis;

  const text =
    language === "vi"
      ? {
          title: "EcoAlert AI Giám định môi trường",
          subtitle:
            "Phân tích bằng chứng hình ảnh và nội dung báo cáo để hỗ trợ cán bộ đánh giá.",
          assist: "AI hỗ trợ",
          unavailable:
            alert.aiFailureReason ||
            "Dịch vụ phân tích AI tạm thời không khả dụng.",
          category: "Phân loại tự động",
          confidence: "Độ tin cậy phân loại",
          severity: "Mức độ đề xuất",
          incident: "Đánh giá sự cố môi trường",
          likely: "Có khả năng là sự cố",
          insufficient: "Chưa đủ bằng chứng",
          score: "Chỉ số tin cậy của phân tích",
          assessment: "Nhận định thuật toán",
          reason: "Cơ sở nhận định",
          disclaimer:
            "Kết quả AI chỉ mang tính hỗ trợ. Danh mục, mức độ và kết luận cuối cùng cần được cán bộ hoặc người có thẩm quyền xác nhận trước khi sử dụng để xử lý báo cáo.",
          failedTitle: "Không thể hoàn tất giám định AI",
          failedHint:
            "Thông tin báo cáo vẫn được giữ nguyên và có thể tiếp tục được xử lý thủ công.",
        }
      : {
          title: "EcoAlert AI Environmental Assessment",
          subtitle:
            "Analyzes image evidence and report content to support human review.",
          assist: "AI assisted",
          unavailable:
            alert.aiFailureReason || "AI analysis is temporarily unavailable.",
          category: "Automated classification",
          confidence: "Classification confidence",
          severity: "Suggested severity",
          incident: "Environmental incident assessment",
          likely: "Likely an incident",
          insufficient: "Insufficient evidence",
          score: "Analysis confidence score",
          assessment: "Algorithm assessment",
          reason: "Assessment basis",
          disclaimer:
            "AI output is advisory only. Category, severity, and final conclusions require confirmation by an authorized human reviewer before operational use.",
          failedTitle: "AI assessment could not be completed",
          failedHint:
            "The report remains available and can continue through manual review.",
        };

  if (!analysis) {
    if (alert.aiAnalysisMode !== "FAILED") return null;

    return (
      <section
        className="overflow-hidden rounded-2xl border border-amber-400/20 bg-[#0b1727] shadow-[0_18px_60px_rgba(0,0,0,0.14)]"
        aria-labelledby="overall-ai-analysis-heading"
      >
        <div className="flex items-start gap-3 px-5 py-5 sm:px-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/[0.08] text-amber-300">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
          </span>

          <div className="min-w-0">
            <h2
              id="overall-ai-analysis-heading"
              className="text-[15px] font-semibold text-slate-100"
            >
              {text.failedTitle}
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              {text.unavailable}
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              {text.failedHint}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const confidenceValue = toPercentValue(analysis.categoryConfidence);
  const categoryLabel = getIncidentCategoryLabel(
    analysis.categorySuggestion,
    language,
  );
  const severityLabel = getIncidentSeverityLabel(analysis.severity, language);
  const confidenceTier = getConfidenceTierLabel(
    analysis.confidenceTier,
    language,
  );

  return (
    <section
      className="overflow-hidden rounded-2xl border border-[#10B981]/20 bg-[#0b1727] shadow-[0_18px_60px_rgba(0,0,0,0.14)]"
      aria-labelledby="overall-ai-analysis-heading"
    >
      <div className="relative border-b border-slate-800/80 px-5 py-5 sm:px-6">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_55%)]"
          aria-hidden="true"
        />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#10B981]/20 bg-[#10B981]/[0.08] text-[#10B981] shadow-[0_0_24px_rgba(16,185,129,0.1)]">
              <BrainCircuit className="h-5 w-5" aria-hidden="true" />
            </span>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="overall-ai-analysis-heading"
                  className="text-[15px] font-semibold text-slate-100 sm:text-base"
                >
                  {text.title}
                </h2>
                <span className="rounded-md border border-[#10B981]/20 bg-[#10B981]/[0.08] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#10B981]">
                  {text.assist}
                </span>
              </div>

              <p className="mt-1.5 max-w-2xl text-xs leading-5 text-slate-500 sm:text-[13px]">
                {text.subtitle}
              </p>
            </div>
          </div>

          <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-slate-700/80 bg-[#071321] px-2.5 py-1.5 text-[10px] font-semibold text-slate-300">
            <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" aria-hidden="true" />
            {confidenceTier}
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <dl className="grid overflow-hidden rounded-xl border border-slate-800/90 bg-[#071321]/75 sm:grid-cols-3">
          <div className="border-b border-slate-800/80 p-4 sm:border-b-0 sm:border-r">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {text.category}
            </dt>
            <dd className="mt-2 break-words text-sm font-semibold text-slate-100">
              {categoryLabel}
            </dd>
          </div>

          <div className="border-b border-slate-800/80 p-4 sm:border-b-0 sm:border-r">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {text.confidence}
            </dt>
            <dd className="mt-2 font-mono text-lg font-bold tabular-nums text-[#10B981]">
              {confidenceValue !== null
                ? `${confidenceValue}%`
                : presentation.unavailable}
            </dd>
          </div>

          <div className="p-4">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {text.severity}
            </dt>
            <dd className="mt-2 text-sm font-semibold text-slate-100">
              {severityLabel}
            </dd>
          </div>
        </dl>

        <div className="mt-4 rounded-xl border border-slate-800/90 bg-[#071321]/55 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                {text.incident}
              </p>
              <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
                {analysis.isIncident ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-300" aria-hidden="true" />
                )}
                {analysis.isIncident ? text.likely : text.insufficient}
              </div>
            </div>

            {confidenceValue !== null ? (
              <span className="font-mono text-xl font-bold tabular-nums text-slate-100">
                {confidenceValue}
                <span className="ml-1 text-xs font-semibold text-slate-500">/ 100</span>
              </span>
            ) : null}
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-medium text-slate-500">
              <span>{text.score}</span>
              <span className="tabular-nums text-slate-400">
                {confidenceValue !== null
                  ? `${confidenceValue}%`
                  : presentation.unavailable}
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-slate-800"
              role={confidenceValue !== null ? "progressbar" : undefined}
              aria-valuemin={confidenceValue !== null ? 0 : undefined}
              aria-valuemax={confidenceValue !== null ? 100 : undefined}
              aria-valuenow={confidenceValue ?? undefined}
            >
              {confidenceValue !== null ? (
                <div
                  className="h-full rounded-full bg-[#10B981] shadow-[0_0_12px_rgba(16,185,129,0.45)] transition-[width] duration-500"
                  style={{ width: `${confidenceValue}%` }}
                />
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-[#10B981]/15 bg-[#10B981]/[0.045] p-4 sm:p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#10B981]">
            <FileText className="h-4 w-4" aria-hidden="true" />
            {text.assessment}
          </div>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">
            {analysis.overallSummary}
          </p>
        </div>

        {analysis.shortReason ? (
          <div className="mt-3 rounded-xl border border-slate-800/80 bg-[#071321]/45 px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {text.reason}
            </p>
            <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-400 sm:text-[13px]">
              {analysis.shortReason}
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-slate-800/80 bg-[#071321]/70 px-3.5 py-3 text-[11px] leading-5 text-slate-500">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#10B981]/80" aria-hidden="true" />
          <p>{text.disclaimer}</p>
        </div>
      </div>
    </section>
  );
}
