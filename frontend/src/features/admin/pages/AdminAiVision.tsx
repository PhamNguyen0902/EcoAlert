import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ScanEye,
  BrainCircuit,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { useAlerts } from "@/hooks/hooks";
import { EnvironmentalAiAnalysisContent } from "@/components/incidents/VisionAnalysisTestPanel";
import { OverallAiAnalysisCard } from "@/components/incidents/OverallAiAnalysisCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useLanguage } from "@/contexts/LanguageContext";
import { getAlertDisplayConfidence } from "@/lib/ai-confidence";
import {
  getIncidentCategoryLabel,
  getIncidentSeverityLabel,
  getIncidentStatusLabel,
} from "@/lib/incident-presentation";
import type { Alert } from "@/types";

// Trang Kiểm định AI Vision (YOLO Object Detection + OpenRouter Semantic Assessment)
export default function AdminAiVision() {
  const { language } = useLanguage();
  const { data, isLoading } = useAlerts(1, 50);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>();

  const alerts = useMemo(() => data?.items ?? [], [data?.items]);

  const filteredAlerts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return alerts;
    return alerts.filter(
      (a: Alert) =>
        a.title.toLowerCase().includes(q) ||
        (a.address || "").toLowerCase().includes(q) ||
        (a.category || "").toLowerCase().includes(q),
    );
  }, [alerts, search]);

  const selectedAlert = useMemo(() => {
    if (selectedId) {
      const found = alerts.find((a) => a._id === selectedId);
      if (found) return found;
    }
    return (
      filteredAlerts.find(
        (a) =>
          (a.visionEvidence && a.visionEvidence.length > 0) ||
          Boolean(a.aiOverallAnalysis),
      ) || filteredAlerts[0]
    );
  }, [alerts, filteredAlerts, selectedId]);

  const stats = useMemo(() => {
    const total = alerts.length;
    const withVision = alerts.filter(
      (a) => (a.visionEvidence?.length ?? 0) > 0,
    ).length;
    const withSemantic = alerts.filter((a) => Boolean(a.aiOverallAnalysis)).length;
    const confidences = alerts
      .map((a) => getAlertDisplayConfidence(a).value)
      .filter((v): v is number => v !== null);
    const avgConfidence =
      confidences.length > 0
        ? Math.round(
            (confidences.reduce((sum, v) => sum + v, 0) / confidences.length) *
              100,
          )
        : 0;
    return { total, withVision, withSemantic, avgConfidence };
  }, [alerts]);

  if (isLoading) {
    return <LoadingSpinner label="Đang tải dữ liệu giám định AI Vision..." />;
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-bold tracking-tight">
              Kiểm định AI Vision & Ngữ nghĩa
            </h1>
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
              YOLO + OpenRouter VLM
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Kiểm tra khung nhận diện vật thể YOLO (bounding boxes), ước lượng khối
            lượng rác và đánh giá ngữ nghĩa tự động trên các báo cáo thực tế.
          </p>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Hồ sơ có YOLO Bounding Box
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-500">
                {stats.withVision}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  / {stats.total} mẫu
                </span>
              </p>
            </div>
            <ScanEye className="h-8 w-8 text-emerald-500/80" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Hồ sơ đã Giám định Ngữ nghĩa
              </p>
              <p className="mt-2 text-2xl font-bold text-blue-500">
                {stats.withSemantic}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  / {stats.total} mẫu
                </span>
              </p>
            </div>
            <BrainCircuit className="h-8 w-8 text-blue-500/80" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Độ tin cậy AI trung bình
              </p>
              <p className="mt-2 text-2xl font-bold text-purple-500">
                {stats.avgConfidence}%
              </p>
            </div>
            <Sparkles className="h-8 w-8 text-purple-500/80" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Cột trái: Danh sách báo cáo để chọn mẫu kiểm định */}
        <div className="space-y-4 lg:col-span-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Chọn Mẫu Báo cáo Thực tế ({filteredAlerts.length})
              </CardTitle>
              <CardDescription>
                Chọn một sự cố để soi chi tiết bounding box và kết quả phân tích AI.
              </CardDescription>
              <div className="relative pt-2">
                <Search className="absolute left-2.5 top-4.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Tìm tiêu đề, danh mục..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 text-sm"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[680px] divide-y overflow-y-auto border-t">
                {filteredAlerts.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    Không tìm thấy báo cáo phù hợp.
                  </p>
                ) : (
                  filteredAlerts.map((alert) => {
                    const isSelected = selectedAlert?._id === alert._id;
                    const confidence = getAlertDisplayConfidence(alert);
                    const hasDetections =
                      (alert.visionEvidence?.reduce(
                        (acc, ev) => acc + ev.detections.length,
                        0,
                      ) ?? 0) > 0;

                    return (
                      <button
                        key={alert._id}
                        type="button"
                        onClick={() => setSelectedId(alert._id)}
                        className={`flex w-full flex-col gap-1.5 p-3.5 text-left transition-colors ${
                          isSelected
                            ? "bg-emerald-500/10"
                            : "hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="line-clamp-1 text-sm font-semibold text-foreground">
                            {alert.title}
                          </span>
                          {confidence.value !== null ? (
                            <Badge
                              variant="outline"
                              className="shrink-0 border-emerald-500/40 font-mono text-[11px] text-emerald-500"
                            >
                              {Math.round(confidence.value * 100)}%
                            </Badge>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span>
                            {getIncidentCategoryLabel(alert.category, language)}
                          </span>
                          <span>·</span>
                          <span>
                            {getIncidentSeverityLabel(alert.severity, language)}
                          </span>
                          <span>·</span>
                          <span>
                            {getIncidentStatusLabel(alert.status, language)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 pt-0.5 text-[11px]">
                          {hasDetections ? (
                            <span className="inline-flex items-center gap-1 text-emerald-500">
                              <CheckCircle2 className="h-3 w-3" />
                              Có khung YOLO
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <AlertTriangle className="h-3 w-3" />
                              Chưa có khung YOLO
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cột phải: Hiển thị trực tiếp VisionAnalysisTestPanel + OverallAiAnalysisCard */}
        <div className="space-y-6 lg:col-span-8">
          {selectedAlert ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{selectedAlert.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Mã hồ sơ: #{selectedAlert._id.slice(-8).toUpperCase()} ·{" "}
                    {selectedAlert.address || "Tọa độ GPS"}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
                  <Link to={`/admin/reports/${selectedAlert._id}`}>
                    Mở hồ sơ báo cáo
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>

              <EnvironmentalAiAnalysisContent alert={selectedAlert} />

              <OverallAiAnalysisCard alert={selectedAlert} />
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-sm text-muted-foreground">
                Chưa có báo cáo nào để kiểm định AI Vision.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
