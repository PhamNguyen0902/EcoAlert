import { useState } from 'react';
import { Eye, Image as ImageIcon, ScanSearch } from 'lucide-react';
import { Alert } from '@/types';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAnalysisModeDisplay, getVisionObjectDisplay, getVisionSupportDisplay } from '@/lib/domain-i18n';

const percentage = (value: number | null | undefined, unavailable: string) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? unavailable
    : `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

export function VisionAnalysisCard({ alert }: { alert: Alert }) {
  const [showAnnotation, setShowAnnotation] = useState(false);
  const { language, t } = useLanguage();
  const vision = alert.aiVision;
  const fusion = alert.aiFusion;
  if (!vision && !fusion) return null;
  const visionSucceeded = vision?.status === 'COMPLETED';
  const detections = Array.isArray(vision?.detections) ? vision.detections : [];
  const objectCounts = Array.isArray(vision?.objectCounts) ? vision.objectCounts : [];
  const detectorStatus = !visionSucceeded
    ? t('common.unavailable')
    : vision?.detectorConfidence === null || vision?.detectorConfidence === undefined
      ? t('common.unavailable')
      : percentage(vision.detectorConfidence, t('common.unavailable'));

  return (
    <section className="rounded-lg border bg-muted/20 p-4" aria-labelledby="vision-analysis-heading">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ScanSearch className="h-4 w-4 text-primary" aria-hidden="true" />
          <h3 id="vision-analysis-heading" className="text-sm font-semibold">{t('ai.vision_title')}</h3>
        </div>
        <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
          {getAnalysisModeDisplay(language, fusion?.mode || vision?.status)}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
        <div><dt className="text-muted-foreground">{t('ai.object_type')}</dt><dd className="mt-1 font-medium">{getVisionObjectDisplay(language, fusion?.wasteType)}</dd></div>
        <div><dt className="text-muted-foreground">{t('ai.object_count')}</dt><dd className="mt-1 font-medium tabular-nums">{visionSucceeded ? vision.totalDetectedObjects : t('common.unavailable')}</dd></div>
        <div><dt className="text-muted-foreground">{t('ai.detector_confidence')}</dt><dd className="mt-1 font-medium">{detectorStatus}</dd></div>
        <div><dt className="text-muted-foreground">{t('ai.vision_support_level')}</dt><dd className="mt-1 font-medium">{getVisionSupportDisplay(language, fusion?.visionSupport)}</dd></div>
      </dl>

      {objectCounts.length ? (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          {t('ai.counts')}: {objectCounts.slice(0, 6).map((item) => `${getVisionObjectDisplay(language, item.label)}: ${item.count}`).join(' · ')}
        </p>
      ) : null}

      {visionSucceeded && detections.length ? (
        <ul className="mt-3 space-y-1.5" aria-label={t('ai.vision_title')}>
          {detections.slice(0, 6).map((detection, index) => (
            <li key={`${detection.label}-${index}`} className="flex items-center justify-between rounded-md border bg-background px-2.5 py-1.5 text-xs">
              <span className="font-medium">{getVisionObjectDisplay(language, detection.label)}</span>
              <span className="tabular-nums text-muted-foreground">{percentage(detection.confidence, t('common.unavailable'))}</span>
            </li>
          ))}
        </ul>
      ) : visionSucceeded ? (
        <p className="mt-3 text-xs text-muted-foreground">{t('ai.no_supported_objects')}</p>
      ) : vision ? (
        <p className="mt-3 text-xs text-muted-foreground">{t('ai.detector_unavailable')}</p>
      ) : null}

      {fusion ? (
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-md border bg-background p-2 text-center text-[10px]">
          <div><p className="text-muted-foreground">{t('ai.semantic')}</p><p className="mt-0.5 font-semibold">{percentage(fusion.semanticConfidence, t('common.unavailable'))}</p></div>
          <div><p className="text-muted-foreground">{t('ai.detector')}</p><p className="mt-0.5 font-semibold">{detectorStatus}</p></div>
          <div><p className="text-muted-foreground">{t('ai.fusion')}</p><p className="mt-0.5 font-semibold">{percentage(fusion.fusionConfidence, t('common.unavailable'))}</p></div>
        </div>
      ) : null}

      {/* Fusion explanations are not persisted as bilingual public text, so they are intentionally not rendered. */}

      {vision?.annotatedImageUrl ? (
        <div className="mt-4">
          <Button size="sm" variant="outline" onClick={() => setShowAnnotation((value) => !value)}>
            {showAnnotation ? <Eye className="mr-2 h-3.5 w-3.5" /> : <ImageIcon className="mr-2 h-3.5 w-3.5" />}
            {showAnnotation ? t('ai.hide_image') : t('ai.view_image')}
          </Button>
          {showAnnotation ? (
            <img
              className="mt-3 w-full rounded-md border object-contain"
              src={vision.annotatedImageUrl}
              alt={t('ai.annotation_alt')}
              loading="lazy"
            />
          ) : null}
        </div>
      ) : null}

      <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
        {t('ai.vision_disclaimer')}
      </p>
    </section>
  );
}
