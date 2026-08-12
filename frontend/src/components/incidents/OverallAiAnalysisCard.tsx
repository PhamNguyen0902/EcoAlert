import { AlertCircle, BrainCircuit, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getCategoryDisplay, getClassificationDisplay, getSeverityDisplay, getVisionObjectDisplay, resolveLocalizedAiText } from '@/lib/domain-i18n';
import type { Alert } from '@/types';

const percentage = (value: number | null | undefined, unavailable: string) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? unavailable
    : `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

/** Semantic incident interpretation; object-level evidence stays in VisionAnalysisCard. */
export function OverallAiAnalysisCard({ alert }: { alert: Alert }) {
  const { language, t } = useLanguage();
  const analysis = alert.aiOverallAnalysis;
  if (!analysis) {
    if (alert.aiAnalysisMode !== 'VISION_ONLY') return null;
    return (
      <section className="rounded-lg border border-primary/20 bg-primary/5 p-4" aria-labelledby="overall-ai-analysis-heading">
        <div className="flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-primary" aria-hidden="true" /><h3 id="overall-ai-analysis-heading" className="text-sm font-semibold">{t('ai.overall_title')}</h3></div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{t('ai.vision_only_fallback')}</p>
      </section>
    );
  }
  const summary = resolveLocalizedAiText(analysis.overallSummaryLocalized, analysis.overallSummary, language);
  const reason = resolveLocalizedAiText(analysis.shortReasonLocalized, analysis.shortReason, language);

  return (
    <section className="rounded-lg border border-primary/20 bg-primary/5 p-4" aria-labelledby="overall-ai-analysis-heading">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-primary" aria-hidden="true" />
          <div><h3 id="overall-ai-analysis-heading" className="text-sm font-semibold">{t('ai.overall_title')}</h3><p className="mt-0.5 text-xs text-muted-foreground">{t('ai.overall_subtitle')}</p></div>
        </div>
        <span className="rounded-full border bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{getClassificationDisplay(language, analysis.confidenceTier)}</span>
      </div>

      <p className="mt-4 text-sm leading-6 text-foreground">{summary}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground"><strong>{t('ai.short_reason')}:</strong> {reason}</p>

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-md border bg-background/70 p-3 text-xs sm:grid-cols-4">
        <div><dt className="text-muted-foreground">{t('ai.suggested_category')}</dt><dd className="mt-1 font-semibold">{getCategoryDisplay(language, analysis.categorySuggestion)}</dd></div>
        <div><dt className="text-muted-foreground">{t('ai.confidence')}</dt><dd className="mt-1 font-semibold">{percentage(analysis.categoryConfidence, t('common.unavailable'))}</dd></div>
        <div><dt className="text-muted-foreground">{t('ai.severity')}</dt><dd className="mt-1 font-semibold">{getSeverityDisplay(language, analysis.severity)}</dd></div>
        <div><dt className="text-muted-foreground">{t('ai.incident')}</dt><dd className="mt-1 font-semibold">{analysis.isIncident ? t('ai.likely') : t('ai.insufficient_evidence')}</dd></div>
      </dl>

      {analysis.visionEvidenceUsed.length > 0 ? <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />{t('ai.vision_support')}: {analysis.visionEvidenceUsed.map((value) => getVisionObjectDisplay(language, value)).join(' · ')}</p> : <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t('ai.no_vision_evidence')}</p>}
    </section>
  );
}
