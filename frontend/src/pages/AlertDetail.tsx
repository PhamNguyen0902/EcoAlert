import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { enUS, vi } from "date-fns/locale";
import { MapContainer, Marker } from "react-leaflet";
import L from "leaflet";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Copy,
  Loader2,
  MapPin,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { useAlert } from "@/hooks/hooks";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EvidenceGallery } from "@/components/incidents/EvidenceGallery";
import { IncidentDetailCard } from "@/components/incidents/IncidentDetailCard";
import {
  formatIncidentCategory,
  getStatusDescription,
  normalizeIncidentStatus,
  SeverityBadge,
  StatusBadge,
} from "@/components/incidents/incident-status";
import { IncidentTimeline } from "@/components/incidents/IncidentTimeline";
import { EnvironmentalAiAnalysis } from "@/components/incidents/EnvironmentalAiAnalysis";
import { IncidentLocationDetails } from "@/components/location/IncidentLocationDetails";
import { hasValidCoordinates } from "@/lib/maps";
import { getAlertDisplaySeverity } from "@/lib/ai-confidence";
import "leaflet/dist/leaflet.css";
import { EcoAlertBaseMap } from "@/components/location/EcoAlertBaseMap";
// trang chi tiết báo cáo sự cố môi trường, hiển thị thông tin chi tiết, hình ảnh minh chứng, phân tích AI và tiến trình xử lý.
const incidentLocationIcon = L.divIcon({
  className: "",
  html: '<span style="display:block;height:24px;width:24px;border:3px solid #fff;border-radius:9999px;background:#10B981;box-shadow:0 3px 10px rgba(16,185,129,.45)"></span>',
  iconAnchor: [12, 12],
  iconSize: [24, 24],
});

const formatDate = (
  value: string | undefined,
  language: "vi" | "en",
  dateFormat = "PPp",
) => {
  const unavailable = language === "vi" ? "Không có" : "Not available";
  if (!value) return unavailable;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? unavailable
    : format(date, dateFormat, { locale: language === "vi" ? vi : enUS });
};

const resolveProgressStep = (status: unknown) => {
  const value = String(status ?? "").trim().toUpperCase();

  if (
    [
      "RESOLVED",
      "COMPLETED",
      "COMPLETE",
      "CLOSED",
      "DONE",
      "DA_HOAN_THANH",
      "HOAN_THANH",
    ].some((token) => value.includes(token))
  ) {
    return 4;
  }

  if (
    [
      "IN_PROGRESS",
      "PROCESSING",
      "HANDLING",
      "WORKING",
      "DANG_XU_LY",
      "XU_LY",
    ].some((token) => value.includes(token))
  ) {
    return 3;
  }

  if (
    [
      "RECEIVED",
      "VERIFIED",
      "ACCEPTED",
      "ASSIGNED",
      "APPROVED",
      "TIEP_NHAN",
      "DA_TIEP_NHAN",
    ].some((token) => value.includes(token))
  ) {
    return 2;
  }

  return 1;
};

type ReportStatusProgressProps = {
  status: ReturnType<typeof normalizeIncidentStatus>;
  createdAt?: string;
  startedAt?: string;
  resolvedAt?: string;
  language: "vi" | "en";
};

function ReportStatusProgress({
  status,
  createdAt,
  startedAt,
  resolvedAt,
  language,
}: ReportStatusProgressProps) {
  const currentStep = resolveProgressStep(status);
  const steps = [
    {
      title: language === "vi" ? "Đã gửi" : "Submitted",
      detail: formatDate(createdAt, language, "HH:mm · dd/MM/yyyy"),
    },
    {
      title: language === "vi" ? "Tiếp nhận" : "Received",
      detail:
        currentStep >= 2
          ? language === "vi"
            ? "Hồ sơ đã được tiếp nhận"
            : "Report received"
          : language === "vi"
            ? "Chờ tiếp nhận"
            : "Awaiting receipt",
    },
    {
      title: language === "vi" ? "Đang xử lý" : "In progress",
      detail: startedAt
        ? formatDate(startedAt, language, "HH:mm · dd/MM/yyyy")
        : currentStep >= 3
          ? language === "vi"
            ? "Đang phối hợp xử lý"
            : "Response in progress"
          : language === "vi"
            ? "Chờ xử lý"
            : "Awaiting action",
    },
    {
      title: language === "vi" ? "Nghiệm thu" : "Verification",
      detail: resolvedAt
        ? formatDate(resolvedAt, language, "HH:mm · dd/MM/yyyy")
        : language === "vi"
          ? "Dự kiến nghiệm thu"
          : "Awaiting verification",
    },
  ];

  const progressPercent =
    steps.length > 1 ? ((currentStep - 1) / (steps.length - 1)) * 100 : 0;

  return (
    <section
      className="mt-6 rounded-xl border border-slate-800/90 bg-[#071321]/75 px-4 py-4 sm:px-5 sm:py-5"
      aria-label={language === "vi" ? "Tiến độ xử lý báo cáo" : "Report progress"}
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-200">
            {language === "vi" ? "Tiến độ xử lý" : "Processing progress"}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {language === "vi"
              ? "Cập nhật theo trạng thái hồ sơ"
              : "Updated from the report workflow"}
          </p>
        </div>

        <span className="shrink-0 rounded-full border border-slate-800 bg-[#0b1727] px-2.5 py-1 text-[10px] font-semibold text-slate-400">
          {language === "vi"
            ? `Bước ${currentStep}/${steps.length}`
            : `Step ${currentStep}/${steps.length}`}
        </span>
      </div>

      {/* Desktop / tablet: compact horizontal stepper */}
      <div className="hidden md:block">
        <div className="relative">
          <div
            className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-[17px] h-px bg-slate-800"
            aria-hidden="true"
          >
            <span
              className="block h-px bg-[#10B981]/70 transition-[width] duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <ol className="relative grid grid-cols-4">
            {steps.map((step, index) => {
              const stepNumber = index + 1;
              const isCompleted = stepNumber < currentStep;
              const isActive = stepNumber === currentStep;
              const isReached = stepNumber <= currentStep;

              return (
                <li
                  key={step.title}
                  className="min-w-0 px-2 text-center"
                  aria-current={isActive ? "step" : undefined}
                >
                  <span
                    className={[
                      "relative z-10 mx-auto flex h-9 w-9 items-center justify-center rounded-full border text-xs font-bold transition-all duration-300",
                      isCompleted
                        ? "border-[#10B981]/70 bg-[#10B981] text-[#04110c] shadow-[0_0_0_4px_rgba(16,185,129,0.08)]"
                        : isActive
                          ? "border-[#10B981] bg-[#0a1d1a] text-[#34d399] shadow-[0_0_0_5px_rgba(16,185,129,0.08),0_0_18px_rgba(16,185,129,0.18)]"
                          : "border-slate-700 bg-[#091522] text-slate-500",
                    ].join(" ")}
                    aria-hidden="true"
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      stepNumber
                    )}
                  </span>

                  <div className="mt-3 min-w-0">
                    <p
                      className={[
                        "truncate text-[13px] font-semibold",
                        isReached ? "text-slate-100" : "text-slate-500",
                      ].join(" ")}
                      title={step.title}
                    >
                      {step.title}
                    </p>
                    <p
                      className={[
                        "mt-1 truncate text-[11px]",
                        isActive
                          ? "font-medium text-[#34d399]/90"
                          : isCompleted
                            ? "text-slate-400"
                            : "text-slate-600",
                      ].join(" ")}
                      title={step.detail}
                    >
                      {step.detail}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* Mobile: vertical stepper so labels never get squeezed */}
      <ol className="space-y-0 md:hidden">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isActive = stepNumber === currentStep;
          const isReached = stepNumber <= currentStep;

          return (
            <li
              key={step.title}
              className="relative flex gap-3 pb-5 last:pb-0"
              aria-current={isActive ? "step" : undefined}
            >
              {index < steps.length - 1 ? (
                <span
                  className={[
                    "absolute left-[17px] top-9 bottom-0 w-px",
                    stepNumber < currentStep
                      ? "bg-[#10B981]/60"
                      : "bg-slate-800",
                  ].join(" ")}
                  aria-hidden="true"
                />
              ) : null}

              <span
                className={[
                  "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                  isCompleted
                    ? "border-[#10B981]/70 bg-[#10B981] text-[#04110c]"
                    : isActive
                      ? "border-[#10B981] bg-[#0a1d1a] text-[#34d399] shadow-[0_0_0_4px_rgba(16,185,129,0.08)]"
                      : "border-slate-700 bg-[#091522] text-slate-500",
                ].join(" ")}
                aria-hidden="true"
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  stepNumber
                )}
              </span>

              <div className="min-w-0 pt-0.5">
                <p
                  className={[
                    "text-sm font-semibold",
                    isReached ? "text-slate-100" : "text-slate-500",
                  ].join(" ")}
                >
                  {step.title}
                </p>
                <p
                  className={[
                    "mt-1 text-xs",
                    isActive
                      ? "font-medium text-[#34d399]/90"
                      : isCompleted
                        ? "text-slate-400"
                        : "text-slate-600",
                  ].join(" ")}
                >
                  {step.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

type ReportHeroCardProps = {
  shortId: string;
  title: string;
  categoryLabel: string;
  createdAt?: string;
  startedAt?: string;
  resolvedAt?: string;
  status: ReturnType<typeof normalizeIncidentStatus>;
  severity: ReturnType<typeof getAlertDisplaySeverity>;
  language: "vi" | "en";
};

function ReportHeroCard({
  shortId,
  title,
  categoryLabel,
  createdAt,
  startedAt,
  resolvedAt,
  status,
  severity,
  language,
}: ReportHeroCardProps) {
  return (
    <section className="rounded-2xl border border-slate-800/90 bg-[#0b1727] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)] sm:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{language === "vi" ? "Mã hồ sơ:" : "Report ID:"}</span>
            <code className="rounded-md border border-slate-700/80 bg-[#071321] px-2 py-1 font-mono text-[11px] font-semibold tracking-[0.08em] text-slate-300">
              #{shortId}
            </code>
          </div>

          <h1 className="mt-4 max-w-5xl break-words text-2xl font-bold leading-tight tracking-[-0.02em] text-slate-50 sm:text-[30px]">
            {title}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-400 sm:text-sm">
            <span className="inline-flex items-center rounded-md border border-slate-700/90 bg-[#071321] px-2.5 py-1 text-xs font-medium text-slate-200">
              {categoryLabel}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              {formatDate(createdAt, language, "dd/MM/yyyy · HH:mm")}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 xl:max-w-[300px] xl:justify-end">
          <StatusBadge status={status} />
          <SeverityBadge severity={severity} />
        </div>
      </div>

      <ReportStatusProgress
        status={status}
        createdAt={createdAt}
        startedAt={startedAt}
        resolvedAt={resolvedAt}
        language={language}
      />
    </section>
  );
}
// trang chi tiết báo cáo sự cố môi trường, hiển thị thông tin chi tiết, hình ảnh minh chứng, phân tích AI và tiến trình xử lý.
export default function AlertDetail() {
  const { t, language } = useLanguage();
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: alert, isLoading, isError } = useAlert(id);

  if (isLoading) {
    return (
      <div
        className="dark flex min-h-[70vh] items-center justify-center bg-[#06111f] text-slate-100"
        role="status"
      >
        <Loader2 className="h-8 w-8 animate-spin text-[#10B981]" />
        <span className="sr-only">
          {language === "vi"
            ? "Đang tải báo cáo sự cố"
            : "Loading incident report"}
        </span>
      </div>
    );
  }

  if (isError || !alert) {
    return (
      <div className="dark min-h-[70vh] bg-[#06111f] px-4 py-16 text-slate-100">
        <div className="mx-auto flex max-w-lg flex-col items-center rounded-2xl border border-rose-500/20 bg-[#0b1727] px-6 py-12 text-center shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
          <AlertCircle className="h-9 w-9 text-rose-400" aria-hidden="true" />
          <h1 className="mt-4 text-lg font-semibold">{t("report_not_found")}</h1>
          <p className="mt-2 text-sm text-slate-400">
            Báo cáo này có thể không còn khả dụng hoặc bạn không có quyền xem.
          </p>
          <Button className="mt-6" variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Quay lại
          </Button>
        </div>
      </div>
    );
  }

  const [longitude = Number.NaN, latitude = Number.NaN] =
    alert.location?.coordinates ?? [];
  const hasCoordinates = hasValidCoordinates(latitude, longitude);
  const status = normalizeIncidentStatus(alert.status);
  const originalEvidence = alert.mediaUrls ?? [];
  const resolutionEvidence = (alert.resolutionEvidence ?? [])
    .map((item) => item.url)
    .filter(Boolean);
  const hasTreatmentResult = Boolean(
    alert.resolutionSummary ||
    alert.treatmentMethod ||
    alert.resolutionNotes ||
    resolutionEvidence.length,
  );
  const displaySeverity = getAlertDisplaySeverity(alert);
  const shortId = alert._id.slice(-8).toUpperCase();

  return (
    <div className="dark min-h-screen bg-[#06111f] text-slate-100">
      <div className="mx-auto w-full max-w-[1440px] px-4 pb-12 pt-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <nav
            className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500"
            aria-label="Điều hướng báo cáo"
          >
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 rounded-md px-1 py-1 transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]/50"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              {language === "vi" ? "Báo cáo của tôi" : "My reports"}
            </button>
            <span aria-hidden="true" className="text-slate-700">/</span>
            <span className="truncate font-semibold text-slate-300">
              {language === "vi" ? "Chi tiết báo cáo" : "Report details"}
            </span>
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(`#${shortId}`)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-800 bg-[#0b1727] px-3 text-xs font-medium text-slate-300 transition-colors hover:border-slate-700 hover:bg-[#0e1d30] hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]/50"
              title={language === "vi" ? "Sao chép mã báo cáo" : "Copy report ID"}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              {language === "vi" ? "Sao chép mã" : "Copy ID"}
            </button>

            <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-800 bg-[#0b1727] px-3 text-[11px] font-semibold tracking-wide text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]/80" aria-hidden="true" />
              VN-2000
            </span>
          </div>
        </div>

        <ReportHeroCard
          shortId={shortId}
          title={alert.title}
          categoryLabel={formatIncidentCategory(alert.category, language)}
          createdAt={alert.createdAt}
          startedAt={alert.startedAt}
          resolvedAt={alert.resolvedAt}
          status={status}
          severity={displaySeverity}
          language={language}
        />

        <main className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <IncidentDetailCard
            categoryLabel={formatIncidentCategory(alert.category, language)}
            reportedAt={formatDate(alert.createdAt, language, "dd/MM/yyyy · HH:mm")}
            reporterLabel={
              alert.citizenId ? "Công dân đã xác thực" : "Công dân ẩn danh"
            }
            severity={displaySeverity}
            description={alert.description}
          />

          <EvidenceGallery
            title="Hình ảnh minh chứng thực địa"
            description="Hình ảnh gốc do người dân gửi kèm báo cáo sự cố."
            images={originalEvidence}
            emptyMessage={t("alert_detail.no_media")}
            altPrefix="Hình ảnh minh chứng"
          />

          <EnvironmentalAiAnalysis alert={alert} />

          {hasTreatmentResult ? (
            <section
              className="border-t pt-8"
              aria-labelledby="treatment-result-heading"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h2
                    id="treatment-result-heading"
                    className="text-lg font-semibold"
                  >
                    Kết quả xử lý của Cán bộ
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Hồ sơ xử lý được lưu trữ độc lập với bằng chứng ban đầu của
                    người dân.
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-5 border-y py-5 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Tóm tắt kết quả
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                    {alert.resolutionSummary || "Chưa cung cấp"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Phương pháp xử lý
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                    {alert.treatmentMethod || "Chưa cung cấp"}
                  </p>
                </div>
                {alert.materialsUsed ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Vật tư & Thiết bị
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                      {alert.materialsUsed}
                    </p>
                  </div>
                ) : null}
                {alert.resolutionNotes ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Ghi chú bổ sung
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                      {alert.resolutionNotes}
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="mt-6">
                <EvidenceGallery
                  title="Hình ảnh sau xử lý"
                  images={resolutionEvidence}
                  emptyMessage="Chưa có hình ảnh sau xử lý."
                  altPrefix="Hình ảnh sau xử lý"
                />
              </div>
            </section>
          ) : null}
        </div>

          {/* Phần hiển thị bản đồ vị trí sự cố và tóm tắt tiến độ xử lý */}

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="p-5">
                <IncidentLocationDetails
                  address={alert.address}
                  latitude={latitude}
                  longitude={longitude}
                />
              </div>
              {hasCoordinates ? (
                <div className="h-64 border-t bg-muted">

                  {/* Bản đồ hiển thị vị trí sự cố nếu có tọa độ GPS hợp lệ */}
                  
                  <MapContainer
                    center={[latitude, longitude]}
                    zoom={15}
                    scrollWheelZoom={false}
                    className="h-full w-full"
                    aria-label="Bản đồ vị trí sự cố"
                  >
                    <EcoAlertBaseMap />
                    <Marker position={[latitude, longitude]} icon={incidentLocationIcon} />
                  </MapContainer>
                </div>
              ) : (
                <div className="flex min-h-36 flex-col items-center justify-center border-t px-5 text-center text-sm text-muted-foreground">
                  <MapPin className="h-5 w-5" aria-hidden="true" />
                  <p className="mt-2">
                    Không thể hiển thị bản đồ vì báo cáo chưa có tọa độ GPS xác
                    thực.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

              {/* Tóm tắt tiến độ */}

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <UserCheck
                  className="h-4 w-4 text-primary"
                  aria-hidden="true"
                />
                <h2 className="font-semibold">Tóm tắt tiến độ</h2>
              </div>
              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Phân công</dt>
                  <dd className="text-right font-medium">
                    {alert.assignedOfficerId
                      ? "Đã phân công cán bộ"
                      : "Đang chờ phân công"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Bắt đầu xử lý</dt>
                  <dd className="text-right">
                    {formatDate(alert.startedAt, language)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Đã đến hiện trường</dt>
                  <dd className="text-right">
                    {formatDate(alert.arrivedAt, language)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Hoàn thành xử lý</dt>
                  <dd className="text-right">
                    {formatDate(alert.resolvedAt, language)}
                  </dd>
                </div>
              </dl>
              <div className="mt-5 rounded-lg bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">
                <CheckCircle2
                  className="mr-1 inline h-3.5 w-3.5 text-primary"
                  aria-hidden="true"
                />
                {getStatusDescription(status, language)}
              </div>
            </CardContent>
          </Card>
        </aside>

      {/* Timeline hiển thị tiến trình xử lý sự cố */}
        <section
          className="min-w-0 xl:col-start-1"
          aria-label={t("alert_detail.timeline")}
        >
          <IncidentTimeline
            entries={alert.timeline}
            createdAt={alert.createdAt}
            citizenId={alert.citizenId}
          />
        </section>
        </main>
      </div>
    </div>
  );
}
