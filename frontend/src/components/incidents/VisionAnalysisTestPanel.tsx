import { useMemo, useState } from "react";
import { Bot, ChevronDown, ScanSearch } from "lucide-react";

import type { Alert, VisionEvidence } from "@/types";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getIncidentCategoryLabel,
  getIncidentSeverityLabel,
} from "@/lib/incident-presentation";

// Định dạng khối lượng sang kg hoặc tấn
const formatMass = (value: number) =>
  value >= 1000
    ? `${(value / 1000).toFixed(1)} tấn`
    : `${Math.round(value)} kg`;

// Định dạng số thập phân thành %
const percent = (value: number | null | undefined) =>
  typeof value === "number" ? `${Math.round(value * 100)}%` : "—";

// Bảng phân tích hiện trường từ AI Vision
export function EnvironmentalAiAnalysisContent({
  alert,
}: {
  alert: Alert;
}) {
  const { language } = useLanguage();

  const [selectedImage, setSelectedImage] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [imageSize, setImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const analysis = alert.aiOverallAnalysis;

  const isWastePipeline =
    alert.analysisPipeline === "WASTE_DETECTION";

  const evidence = isWastePipeline
    ? (alert.visionEvidence ?? [])
    : [];

  const selectedEvidence = evidence[selectedImage];
  const detections = selectedEvidence?.detections ?? [];

  const groups = useMemo(() => {
    const map = new Map<string, number>();

    evidence.forEach((item) => {
      item.detections.forEach((detection) => {
        map.set(
          detection.materialClass,
          (map.get(detection.materialClass) ?? 0) + 1,
        );
      });
    });

    return Array.from(map.entries()).sort(
      (a, b) => b[1] - a[1],
    );
  }, [evidence]);

  const mass = analysis?.massEstimate;

  const massText =
    mass?.available &&
    mass.minKg !== null &&
    mass.maxKg !== null
      ? `${formatMass(mass.minKg)} – ${formatMass(mass.maxKg)}`
      : "Chưa thể ước tính";

  const aiConfidence = percent(
    isWastePipeline
      ? (mass?.confidence ?? analysis?.categoryConfidence)
      : analysis?.categoryConfidence,
  );

  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-800/90 bg-[#0b1727]"
      aria-labelledby="environmental-ai-heading"
    >
      {/* Header */}
      <header className="flex items-start gap-3 border-b border-slate-800 px-4 py-4 sm:px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#10B981]/10 text-[#10B981]">
          <ScanSearch className="h-4 w-4" />
        </span>

        <div>
          <h2
            id="environmental-ai-heading"
            className="text-sm font-semibold text-slate-100"
          >
            EcoAlert AI · Phân tích hiện trường
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Kết quả tự động từ minh chứng đã gửi cùng báo cáo.
          </p>
        </div>
      </header>

      <div className="p-4 sm:p-5">
        {/* Processing state */}
        {["PROCESSING", "PENDING"].includes(
          alert.aiAnalysisStatus ?? "",
        ) && (
          <p className="mb-4 rounded-xl border border-[#10B981]/20 bg-[#10B981]/[0.06] p-4 text-sm text-[#A7F3D0]">
            AI đang nhận diện hiện trường. Kết quả sẽ tự xuất hiện
            sau khi xử lý hoàn tất.
          </p>
        )}

        {/* Failed state */}
        {alert.aiAnalysisStatus === "FAILED" && (
          <p className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-sm text-amber-200">
            Báo cáo đã được lưu, nhưng AI chưa hoàn tất phân tích.
            Nhân viên vẫn có thể xử lý sự cố.
          </p>
        )}

        {/* Kết quả phân tích */}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,.9fr)]">
          {/* Image analysis */}
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#071321]">
            {alert.mediaUrls[selectedImage] ? (
              <div className="relative">
                <img
                  src={alert.mediaUrls[selectedImage]}
                  alt={`Minh chứng ${selectedImage + 1}`}
                  className="max-h-[520px] w-full object-contain"
                  onLoad={(event) =>
                    setImageSize({
                      width: event.currentTarget.naturalWidth,
                      height: event.currentTarget.naturalHeight,
                    })
                  }
                />

                {/* Khung nhận diện */}
                {imageSize &&
                  detections.map((detection, index) => {
                    const [x1, y1, x2, y2] = detection.bbox;

                    return (
                      <span
                        key={`${detection.materialClass}-${index}`}
                        className="absolute border-2 border-[#10B981] bg-[#10B981]/10 px-1 text-[9px] font-bold text-[#10B981]"
                        style={{
                          left: `${(x1 / imageSize.width) * 100}%`,
                          top: `${(y1 / imageSize.height) * 100}%`,
                          width: `${((x2 - x1) / imageSize.width) * 100}%`,
                          height: `${((y2 - y1) / imageSize.height) * 100}%`,
                        }}
                      >
                        {detection.materialClass}
                      </span>
                    );
                  })}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-slate-500">
                Chưa có ảnh minh chứng.
              </div>
            )}

            {/* Danh sách ảnh */}
            {alert.mediaUrls.length > 1 && (
              <div className="flex gap-2 overflow-x-auto border-t border-slate-800 p-2">
                {alert.mediaUrls.map((url, index) => (
                  <button
                    type="button"
                    key={url}
                    onClick={() => setSelectedImage(index)}
                    className={[
                      "h-14 w-16 shrink-0 overflow-hidden rounded border",
                      index === selectedImage
                        ? "border-[#10B981]"
                        : "border-slate-700",
                    ].join(" ")}
                  >
                    <img
                      src={url}
                      alt={`Ảnh ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Kết quả phân tích */}
          <aside className="rounded-xl border border-slate-800 bg-[#071321] p-4">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-[#10B981]" />

              <h3 className="text-sm font-semibold text-slate-100">
                Kết quả phân tích
              </h3>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <Metric
                label="Phân loại"
                value={
                  analysis?.categorySuggestion
                    ? getIncidentCategoryLabel(
                        analysis.categorySuggestion,
                        language,
                      )
                    : "Chưa có"
                }
              />

              <Metric
                label="Mức độ"
                value={
                  analysis?.severity
                    ? getIncidentSeverityLabel(
                        analysis.severity,
                        language,
                      )
                    : "Chưa có"
                }
              />

              {isWastePipeline && (
                <Metric
                  label="Khối lượng ước tính"
                  value={massText}
                  accent
                />
              )}

              <Metric
                label="Độ tin cậy AI"
                value={aiConfidence}
                accent
              />
            </div>

            {/* Nhận định AI */}
            <div className="mt-4 rounded-lg border border-[#10B981]/15 bg-[#10B981]/[0.045] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#10B981]">
                Nhận định AI
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-300">
                {analysis?.overallSummary ??
                  "Chưa có kết quả phân tích."}
              </p>
            </div>
          </aside>
        </div>

        {/* Xem chi tiết vật thể */}
        {isWastePipeline && evidence.length > 0 && (
          <button
            type="button"
            onClick={() =>
              setShowDetails((current) => !current)
            }
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#10B981]"
          >
            Xem chi tiết nhận diện

            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                showDetails ? "rotate-180" : ""
              }`}
            />
          </button>
        )}

        {/* Chi tiết kỹ thuật */}
        {isWastePipeline && showDetails && (
          <TechnicalDetails
            evidence={evidence}
            groups={groups}
            limitations={mass?.limitations ?? []}
          />
        )}
      </div>
    </section>
  );
}

// Hiển thị một metric của AI
function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-[#0b1727] p-3">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p
        className={`mt-2 text-sm font-bold ${
          accent ? "text-[#10B981]" : "text-slate-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// Chi tiết kỹ thuật từ Vision model
function TechnicalDetails({
  evidence,
  groups,
  limitations,
}: {
  evidence: VisionEvidence[];
  groups: [string, number][];
  limitations: string[];
}) {
  return (
    <div className="mt-3 rounded-xl border border-slate-800 bg-[#071321] p-4 text-xs text-slate-300">
      <p className="font-semibold">
        Chi tiết nhận diện kỹ thuật
      </p>

      {/* Number of detections per image */}
      <div className="mt-3 space-y-1 text-slate-400">
        {evidence.map((item, index) => (
          <p key={item.imageUrl}>
            Ảnh {index + 1}: {item.detections.length} vùng phát hiện.
          </p>
        ))}
      </div>

      {/* Material groups */}
      {groups.length > 0 && (
        <p className="mt-3">
          Nhóm vật liệu:{" "}
          {groups
            .map(
              ([name, count]) =>
                `${name} (${count} vùng)`,
            )
            .join(", ")}
          .
        </p>
      )}

      {/* Limitations */}
      {limitations.length > 0 && (
        <p className="mt-3 text-slate-500">
          Giới hạn: {limitations.join("; ")}
        </p>
      )}
    </div>
  );
}