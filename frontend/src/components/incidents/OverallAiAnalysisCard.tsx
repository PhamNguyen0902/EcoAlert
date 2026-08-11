import { AlertCircle, BrainCircuit, Sparkles } from 'lucide-react';
import type { Alert } from '@/types';

const humanize = (value?: string | null) => value
  ? value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
  : 'Chưa phân loại';

const percentage = (value?: number | null) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? 'Không có'
    : `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

/** Semantic incident interpretation; object-level evidence stays in VisionAnalysisCard. */
export function OverallAiAnalysisCard({ alert }: { alert: Alert }) {
  const analysis = alert.aiOverallAnalysis;
  if (!analysis) {
    if (alert.aiAnalysisMode !== 'VISION_ONLY') return null;
    return (
      <section className="rounded-lg border border-primary/20 bg-primary/5 p-4" aria-labelledby="overall-ai-analysis-heading">
        <div className="flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-primary" aria-hidden="true" /><h3 id="overall-ai-analysis-heading" className="text-sm font-semibold">AI phân tích tổng quan</h3></div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Phân tích ngữ nghĩa hiện không khả dụng. Vision vẫn đã nhận diện được các vật thể trong ảnh.</p>
      </section>
    );
  }
  const unclassified = analysis.classificationStatus === 'UNCLASSIFIED';

  return (
    <section className="rounded-lg border border-primary/20 bg-primary/5 p-4" aria-labelledby="overall-ai-analysis-heading">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-primary" aria-hidden="true" />
          <div><h3 id="overall-ai-analysis-heading" className="text-sm font-semibold">AI phân tích tổng quan</h3><p className="mt-0.5 text-xs text-muted-foreground">Diễn giải sự cố ở cấp độ hình ảnh và báo cáo; cần con người xác nhận.</p></div>
        </div>
        <span className="rounded-full border bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{analysis.confidenceTier === 'HIGH_CONFIDENCE' ? 'Độ tin cậy cao' : unclassified ? 'Chưa phân loại' : 'Cần xác nhận'}</span>
      </div>

      <p className="mt-4 text-sm leading-6 text-foreground">{analysis.overallSummary}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground"><strong>Lý do ngắn:</strong> {analysis.shortReason}</p>

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-md border bg-background/70 p-3 text-xs sm:grid-cols-4">
        <div><dt className="text-muted-foreground">Danh mục AI gợi ý</dt><dd className="mt-1 font-semibold">{humanize(analysis.categorySuggestion)}</dd></div>
        <div><dt className="text-muted-foreground">Độ tin cậy</dt><dd className="mt-1 font-semibold">{percentage(analysis.categoryConfidence)}</dd></div>
        <div><dt className="text-muted-foreground">Mức độ</dt><dd className="mt-1 font-semibold">{humanize(analysis.severity)}</dd></div>
        <div><dt className="text-muted-foreground">Sự cố môi trường</dt><dd className="mt-1 font-semibold">{analysis.isIncident ? 'Có khả năng' : 'Chưa đủ bằng chứng'}</dd></div>
      </dl>

      {analysis.visionEvidenceUsed.length > 0 ? <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />Vision hỗ trợ: {analysis.visionEvidenceUsed.join(' · ')}</p> : <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />Không có đối tượng rác EcoAlert được dùng làm bằng chứng. Điều này không tự động phủ nhận sự cố.</p>}
    </section>
  );
}
