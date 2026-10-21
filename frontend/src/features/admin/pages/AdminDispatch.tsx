import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  Route,
  Users,
  UserCheck,
  Clock,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  MapPin,
} from "lucide-react";
import { useAlerts, useOfficerAvailability } from "@/hooks/hooks";
import { AssignmentPreview } from "../components/AssignmentPreview";
import { assignmentReasonLabel } from "@/services/serviceAreas";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getIncidentCategoryLabel,
  getIncidentSeverityLabel,
  getIncidentStatusLabel,
} from "@/lib/incident-presentation";
import type { Alert, OfficerAvailability } from "@/types";

// Trang Điều phối Nhiệm vụ & Theo dõi Ca trực Cán bộ thực địa
export default function AdminDispatch() {
  const { language } = useLanguage();
  const [selectedAlertId, setSelectedAlertId] = useState<string>();

  const {
    data: unassignedData,
    isLoading: isUnassignedLoading,
    refetch: refetchUnassigned,
    isRefetching: isUnassignedRefetching,
  } = useAlerts(1, 50, { unassigned: "true" });

  const {
    data: activeData,
    isLoading: isActiveLoading,
    refetch: refetchActive,
  } = useAlerts(1, 50);

  const {
    data: officerAvailability,
    isLoading: isOfficersLoading,
    refetch: refetchOfficers,
  } = useOfficerAvailability(true);

  const unassignedAlerts = useMemo(
    () => unassignedData?.items ?? [],
    [unassignedData?.items],
  );

  const activeFieldAlerts = useMemo(
    () =>
      (activeData?.items ?? []).filter((a: Alert) =>
        ["assigned", "in_progress"].includes(a.status.toLowerCase()),
      ),
    [activeData?.items],
  );

  const availabilityList = useMemo(
    () => (officerAvailability ?? []) as OfficerAvailability[],
    [officerAvailability],
  );

  const onShiftOfficers = availabilityList.filter(
    (item) => item.shiftStatus === "ON_SHIFT",
  );

  const currentPreviewId = selectedAlertId || unassignedAlerts[0]?._id;

  const handleRefreshAll = () => {
    void refetchUnassigned();
    void refetchActive();
    void refetchOfficers();
  };

  if (isUnassignedLoading && isOfficersLoading && isActiveLoading) {
    return <LoadingSpinner label="Đang tải dữ liệu điều phối & ca trực..." />;
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-bold tracking-tight">
              Điều phối & Ca trực Hiện trường
            </h1>
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
              GIS + OSRM Dispatch
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Theo dõi hàng đợi sự cố chờ phân công, kiểm tra khu vực dịch vụ GIS
            và giám sát lực lượng cán bộ đang trong ca trực.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshAll}
          disabled={isUnassignedRefetching}
          className="gap-2 self-start sm:self-auto"
        >
          <RefreshCw
            className={`h-4 w-4 ${isUnassignedRefetching ? "animate-spin" : ""}`}
          />
          Làm mới điều phối
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-amber-500/25 bg-amber-500/[0.03]">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Hàng đợi chờ phân công
              </p>
              <p className="mt-2 text-3xl font-bold text-amber-500">
                {unassignedData?.total ?? unassignedAlerts.length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Báo cáo đã xác minh chờ gán cán bộ
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/25 bg-emerald-500/[0.03]">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cán bộ đang trong ca
              </p>
              <p className="mt-2 text-3xl font-bold text-emerald-500">
                {onShiftOfficers.length}{" "}
                <span className="text-base font-normal text-muted-foreground">
                  / {availabilityList.length}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Sẵn sàng nhận điều phối tự động theo vùng
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
              <UserCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-500/25 bg-blue-500/[0.03]">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Đang tác nghiệp hiện trường
              </p>
              <p className="mt-2 text-3xl font-bold text-blue-500">
                {activeFieldAlerts.length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Nhiệm vụ đã giao hoặc đang xử lý
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 text-blue-500">
              <Route className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Split Grid: Left = Unassigned Queue, Right = AssignmentPreview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Hàng đợi Sự cố Chờ Phân công ({unassignedAlerts.length})</span>
                <Button asChild variant="ghost" size="sm" className="text-xs">
                  <Link to="/admin/reports">
                    Mở Quản lý báo cáo
                    <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardTitle>
              <CardDescription>
                Chọn một sự cố bên dưới để kiểm tra vùng phủ GIS và tự động gán
                cán bộ đang trong ca trực.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {unassignedAlerts.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500/70" />
                  Tất cả báo cáo đã xác minh đều đã được phân công cán bộ.
                </div>
              ) : (
                <div className="divide-y border-t">
                  {unassignedAlerts.map((alert: Alert) => {
                    const isSelected = currentPreviewId === alert._id;
                    return (
                      <div
                        key={alert._id}
                        onClick={() => setSelectedAlertId(alert._id)}
                        className={`flex cursor-pointer flex-col gap-2 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                          isSelected
                            ? "bg-emerald-500/10"
                            : "hover:bg-muted/40"
                        }`}
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-foreground">
                              {alert.title}
                            </span>
                            <Badge variant="outline" className="text-[11px]">
                              {getIncidentSeverityLabel(alert.severity, language)}
                            </Badge>
                            <Badge variant="secondary" className="text-[11px]">
                              {getIncidentCategoryLabel(alert.category, language)}
                            </Badge>
                          </div>
                          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                            {alert.address || "Tọa độ GPS đã ghi nhận"}
                          </p>
                          <p className="text-xs text-amber-500">
                            {assignmentReasonLabel(
                              alert.lastAssignmentAttempt?.reason,
                            )}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            size="sm"
                            variant={isSelected ? "default" : "outline"}
                            className="h-8 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAlertId(alert._id);
                            }}
                          >
                            Kiểm tra điều phối
                          </Button>
                          <Button
                            asChild
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Link to={`/admin/reports/${alert._id}`}>
                              Hồ sơ →
                            </Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Danh sách nhiệm vụ đang thực thi tại hiện trường */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-blue-500" />
                Nhiệm vụ Đang Xử lý Tại Hiện trường ({activeFieldAlerts.length})
              </CardTitle>
              <CardDescription>
                Các sự cố đã có cán bộ tiếp nhận hoặc đã Check-in GPS tại hiện trường.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {activeFieldAlerts.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  Hiện không có nhiệm vụ nào đang xử lý ngoài hiện trường.
                </p>
              ) : (
                <div className="divide-y border-t">
                  {activeFieldAlerts.slice(0, 8).map((alert: Alert) => (
                    <div
                      key={alert._id}
                      className="flex items-center justify-between gap-4 p-4 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{alert.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {alert.address || "Đã có tọa độ"} ·{" "}
                          {alert.assignedAreaName || "Phân công trực tiếp"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="secondary">
                          {getIncidentStatusLabel(alert.status, language)}
                        </Badge>
                        <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                          <Link to={`/admin/reports/${alert._id}`}>Chi tiết</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live Assignment Preview & Officer Shift Roster */}
        <div className="space-y-6 lg:col-span-5">
          <Card className="border-emerald-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Bộ máy Gợi ý & Điều phối Tự động
              </CardTitle>
              <CardDescription>
                Đối chiếu tọa độ sự cố với đa giác `ServiceArea` và trạng thái ca trực.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentPreviewId ? (
                <>
                  <AssignmentPreview id={currentPreviewId} />
                  <div className="flex justify-end">
                    <Button asChild variant="outline" size="sm" className="text-xs">
                      <Link to={`/admin/reports/${currentPreviewId}`}>
                        Mở trang điều phối chi tiết
                        <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </>
              ) : (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Chọn một báo cáo ở danh sách bên trái để xem trước gợi ý điều
                  phối theo khu vực.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Bảng trạng thái ca trực của đội ngũ Cán bộ */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-emerald-500" />
                Trạng thái Ca trực Đội ngũ Cán bộ ({availabilityList.length})
              </CardTitle>
              <CardDescription>
                Tình trạng ca trực và khối lượng công việc thực tế từ hệ thống.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {availabilityList.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  Chưa có tài khoản cán bộ nào trong hệ thống.
                </p>
              ) : (
                <div className="divide-y border-t">
                  {availabilityList.map((item) => {
                    const isOnShift = item.shiftStatus === "ON_SHIFT";
                    return (
                      <div
                        key={item.officer._id}
                        className="flex items-center justify-between gap-3 p-3.5 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {item.officer.fullName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.officer.email}
                          </p>
                          {item.currentShift?.startedAt && isOnShift ? (
                            <p className="text-[11px] text-emerald-500">
                              Vào ca:{" "}
                              {format(
                                new Date(item.currentShift.startedAt),
                                "HH:mm dd/MM",
                              )}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              isOnShift
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isOnShift ? "bg-emerald-500" : "bg-slate-400"
                              }`}
                            />
                            {isOnShift ? "Trong ca" : "Ngoài ca"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {item.activeTaskCount} việc đang xử lý
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
