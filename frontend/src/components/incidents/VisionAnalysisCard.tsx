import { useState } from 'react';
import { Eye, Image as ImageIcon, ScanSearch } from 'lucide-react';
import { Alert } from '@/types';
import { Button } from '@/components/ui/button';

const humanize = (value?: string) => value
  ? value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase())
  : 'Not determined';

const percentage = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? 'Not available'
    : `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

export function VisionAnalysisCard({ alert }: { alert: Alert }) {
  const [showAnnotation, setShowAnnotation] = useState(false);
  const vision = alert.aiVision;
  const fusion = alert.aiFusion;
  if (!vision && !fusion) return null;
  const visionSucceeded = vision?.status === 'COMPLETED';
  const detections = Array.isArray(vision?.detections) ? vision.detections : [];
  const objectCounts = Array.isArray(vision?.objectCounts) ? vision.objectCounts : [];
  const explanations = Array.isArray(fusion?.explanations) ? fusion.explanations : [];
  const detectorStatus = !visionSucceeded
    ? 'Not available'
    : vision?.detectorConfidence === null || vision?.detectorConfidence === undefined
      ? 'Available'
      : percentage(vision.detectorConfidence);

  return (
    <section className="rounded-lg border bg-muted/20 p-4" aria-labelledby="vision-analysis-heading">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ScanSearch className="h-4 w-4 text-primary" aria-hidden="true" />
          <h3 id="vision-analysis-heading" className="text-sm font-semibold">Vision nhận diện vật thể</h3>
        </div>
        <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
          {humanize(fusion?.mode || vision?.status)}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
        <div><dt className="text-muted-foreground">Loại vật thể</dt><dd className="mt-1 font-medium">{humanize(fusion?.wasteType)}</dd></div>
        <div><dt className="text-muted-foreground">Số vật thể phát hiện</dt><dd className="mt-1 font-medium tabular-nums">{visionSucceeded ? vision.totalDetectedObjects : 'Không có'}</dd></div>
        <div><dt className="text-muted-foreground">Độ tin cậy detector</dt><dd className="mt-1 font-medium">{detectorStatus}</dd></div>
        <div><dt className="text-muted-foreground">Mức hỗ trợ Vision</dt><dd className="mt-1 font-medium">{humanize(fusion?.visionSupport)}</dd></div>
      </dl>

      {objectCounts.length ? (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Counts: {objectCounts.slice(0, 6).map((item) => `${humanize(item.label)}: ${item.count}`).join(' · ')}
        </p>
      ) : null}

      {visionSucceeded && detections.length ? (
        <ul className="mt-3 space-y-1.5" aria-label="Custom waste detections">
          {detections.slice(0, 6).map((detection, index) => (
            <li key={`${detection.label}-${index}`} className="flex items-center justify-between rounded-md border bg-background px-2.5 py-1.5 text-xs">
              <span className="font-medium">{humanize(detection.label)}</span>
              <span className="tabular-nums text-muted-foreground">{percentage(detection.confidence)}</span>
            </li>
          ))}
        </ul>
      ) : visionSucceeded ? (
        <p className="mt-3 text-xs text-muted-foreground">Không phát hiện vật thể rác thuộc sáu lớp EcoAlert. Điều này không tự động phủ nhận sự cố.</p>
      ) : vision ? (
        <p className="mt-3 text-xs text-muted-foreground">Vision không khả dụng cho lần phân tích này.</p>
      ) : null}

      {fusion ? (
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-md border bg-background p-2 text-center text-[10px]">
          <div><p className="text-muted-foreground">Semantic</p><p className="mt-0.5 font-semibold">{percentage(fusion.semanticConfidence)}</p></div>
          <div><p className="text-muted-foreground">Detector</p><p className="mt-0.5 font-semibold">{detectorStatus}</p></div>
          <div><p className="text-muted-foreground">Fusion</p><p className="mt-0.5 font-semibold">{percentage(fusion.fusionConfidence)}</p></div>
        </div>
      ) : null}

      {explanations[0] ? <p className="mt-3 text-xs leading-5 text-muted-foreground">{explanations[0]}</p> : null}

      {vision?.annotatedImageUrl ? (
        <div className="mt-4">
          <Button size="sm" variant="outline" onClick={() => setShowAnnotation((value) => !value)}>
            {showAnnotation ? <Eye className="mr-2 h-3.5 w-3.5" /> : <ImageIcon className="mr-2 h-3.5 w-3.5" />}
            {showAnnotation ? 'Hide AI image' : 'View AI image'}
          </Button>
          {showAnnotation ? (
            <img
              className="mt-3 w-full rounded-md border object-contain"
              src={vision.annotatedImageUrl}
              alt="AI annotation with EcoAlert waste detection boxes"
              loading="lazy"
            />
          ) : null}
        </div>
      ) : null}

      <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
        Đây là bằng chứng ở cấp độ vật thể, tách biệt với phân tích tổng quan. Con người phải kiểm tra ảnh gốc trước khi xác nhận.
      </p>
    </section>
  );
}
