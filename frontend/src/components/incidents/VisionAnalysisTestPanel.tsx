import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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

// Chuẩn hóa và giới hạn (clamp) tọa độ Bounding Box YOLO trong phạm vi [0, 100]% của ảnh thực tế
const computeClampedYoloBox = (
  bbox: number[],
  imageSize: { width: number; height: number },
) => {
  const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = bbox;
  const isPixelCoords = x1 > 1 || y1 > 1 || x2 > 1 || y2 > 1;
  const safeWidth = Math.max(1, imageSize.width);
  const safeHeight = Math.max(1, imageSize.height);

  const rawLeft = isPixelCoords ? (x1 / safeWidth) * 100 : x1 * 100;
  const rawTop = isPixelCoords ? (y1 / safeHeight) * 100 : y1 * 100;
  const rawW = isPixelCoords
    ? ((x2 - x1) / safeWidth) * 100
    : (x2 - x1) * 100;
  const rawH = isPixelCoords
    ? ((y2 - y1) / safeHeight) * 100
    : (y2 - y1) * 100;

  const left = Math.max(0, Math.min(98, rawLeft));
  const top = Math.max(0, Math.min(98, rawTop));
  const width = Math.max(2, Math.min(100 - left, rawW));
  const height = Math.max(2, Math.min(100 - top, rawH));

  return {
    left,
    top,
    width,
    height,
    isNearTopEdge: top < 8,
  };
};

// Bảng phân tích hiện trường từ AI Vision
export function EnvironmentalAiAnalysisContent({
  alert,
}: {
  alert: Alert;
}) {
  const { language } = useLanguage();

  const [selectedImage, setSelectedImage] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [showYoloBoxes, setShowYoloBoxes] = useState(true);
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
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
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
        </div>

        {/* Công tắc iOS bật/tắt khung nhận diện YOLO */}
        <button
          type="button"
          role="switch"
          aria-checked={showYoloBoxes}
          onClick={() => setShowYoloBoxes((prev) => !prev)}
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-300 transition hover:text-white"
        >
          <span>Khung AI: {showYoloBoxes ? "Bật" : "Tắt"}</span>
          <span
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${
              showYoloBoxes ? "bg-emerald-500" : "bg-slate-700"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform duration-200 ${
                showYoloBoxes ? "translate-x-4" : "translate-x-1"
              }`}
            />
          </span>
        </button>
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
              <div className="relative flex min-h-[360px] max-h-[460px] w-full items-center justify-center overflow-hidden rounded-xl bg-slate-950 p-2">
                {/* Lớp nền mờ Apple Preview phía sau để lấp khoảng trống ảnh dọc */}
                <img
                  src={alert.mediaUrls[selectedImage]}
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 h-full w-full scale-110 select-none object-cover opacity-35 blur-2xl"
                />

                {/* Khung nội bộ ôm sát đúng kích thước hiển thị của ảnh (inline-flex) */}
                <div className="relative z-10 inline-flex max-h-[440px] max-w-full items-center justify-center">
                  <img
                    src={alert.mediaUrls[selectedImage]}
                    alt={`Minh chứng ${selectedImage + 1}`}
                    className="block h-auto max-h-[440px] w-auto max-w-full rounded-lg object-contain"
                    onLoad={(event) =>
                      setImageSize({
                        width: event.currentTarget.naturalWidth,
                        height: event.currentTarget.naturalHeight,
                      })
                    }
                  />

                  {/* Khung nhận diện nằm BÊN TRONG khung inline-flex để khớp 100% mép ảnh thật */}
                  <div className="pointer-events-none absolute inset-0">
                    <AnimatePresence>
                      {showYoloBoxes &&
                        imageSize &&
                        detections.map((detection, index) => {
                          const {
                            left,
                            top,
                            width,
                            height,
                            isNearTopEdge,
                          } = computeClampedYoloBox(
                            detection.bbox,
                            imageSize,
                          );
                          const confPct = Math.round(
                            Math.max(0, Math.min(1, detection.confidence)) *
                              100,
                          );

                          return (
                            <motion.div
                              key={`${detection.materialClass}-${index}`}
                              initial={{ opacity: 0, scale: 0.96 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.96 }}
                              transition={{ duration: 0.18 }}
                              className="pointer-events-none absolute rounded-md border-2 border-emerald-400 bg-emerald-500/15 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                              style={{
                                left: `${left}%`,
                                top: `${top}%`,
                                width: `${width}%`,
                                height: `${height}%`,
                              }}
                            >
                              <span
                                className={`absolute left-0 inline-flex max-w-full items-center gap-1 truncate whitespace-nowrap rounded-md bg-emerald-600/95 px-2 py-0.5 text-[11px] font-semibold text-white shadow-md backdrop-blur-md ${
                                  isNearTopEdge ? "top-1" : "-top-6"
                                }`}
                              >
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
                                {detection.materialClass} · {confPct}%
                              </span>
                            </motion.div>
                          );
                        })}
                    </AnimatePresence>
                  </div>
                </div>
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
