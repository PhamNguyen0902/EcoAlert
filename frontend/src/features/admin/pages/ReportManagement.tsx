import { useState } from "react";
import { useAlerts, useDeleteAlert } from "@/hooks/hooks";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Eye,
  Trash2,
  MoreHorizontal,
  ArrowRight,
  CheckCircle2,
  SlidersHorizontal,
} from "lucide-react";
import { format } from "date-fns";
import { Link, useNavigate } from "react-router-dom";
import { Alert } from "@/types";
import toast from "react-hot-toast";
import { AssignmentPreview } from "../components/AssignmentPreview";
import { assignmentReasonLabel } from "@/services/serviceAreas";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getIncidentCategoryLabel,
  getIncidentSeverityLabel,
  getIncidentStatusLabel,
} from "@/lib/incident-presentation";

type WorkQueueTab =
  | "all"
  | "unassigned"
  | "pending"
  | "processing"
  | "resolved";

// bảng quản lý sự cố: tìm kiếm, xóa hoặc xem chi tiết để duyệt và phân công
export default function ReportManagement() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<WorkQueueTab>("all");
  const [previewId, setPreviewId] = useState<string>();

  const unassigned = activeTab === "unassigned";
  const queryFilters: Record<string, string> = unassigned
    ? { unassigned: "true" }
    : {};

  const { data, isLoading } = useAlerts(page, 10, queryFilters);
  const { data: unassignedSummary } = useAlerts(1, 1, { unassigned: "true" });
  const deleteAlert = useDeleteAlert();

  if (isLoading) return <LoadingSpinner />;

  const rawItems = data?.items || [];
  const unassignedCount =
    unassignedSummary?.total ??
    (unassigned
      ? rawItems.length
      : rawItems.filter(
          (a: Alert) =>
            a.status.toLowerCase() === "verified" && !a.assignedOfficerId,
        ).length);

  const filteredAlerts = rawItems.filter((a: Alert) => {
    const matchesSearch = a.title
      .toLowerCase()
      .includes(search.toLowerCase().trim());
    if (!matchesSearch) return false;

    const status = a.status.toLowerCase();
    if (activeTab === "pending") return status === "pending";
    if (activeTab === "processing")
      return status === "assigned" || status === "in_progress";
    if (activeTab === "resolved") return status === "resolved";
    return true;
  });

  const tabs: {
    id: WorkQueueTab;
    label: string;
    badge?: number;
  }[] = [
    { id: "all", label: "Tất cả" },
    {
      id: "unassigned",
      label: "Chờ phân công",
      badge: unassignedCount,
    },
    { id: "pending", label: "Chờ duyệt" },
    { id: "processing", label: "Đang xử lý" },
    { id: "resolved", label: "Chờ nghiệm thu" },
  ];

  const handleSelectTab = (tabId: WorkQueueTab) => {
    setActiveTab(tabId);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {t("reports.management_title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("reports.env_reports")} · Hàng đợi điều phối & nghiệm thu sự cố
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-4 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Work-Queue Segmented Tabs */}
            <div
              role="tablist"
              aria-label="Hàng đợi công việc"
              className="inline-flex flex-wrap items-center gap-1 rounded-lg border bg-muted/40 p-1"
            >
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleSelectTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all sm:text-sm ${
                      isActive
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>{tab.label}</span>
                    {typeof tab.badge === "number" ? (
                      <Badge
                        variant={isActive ? "default" : "secondary"}
                        className="h-5 min-w-5 justify-center px-1.5 text-[11px]"
                      >
                        {tab.badge}
                      </Badge>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Ô tìm kiếm nằm cùng hàng */}
            <div className="relative w-full lg:w-[300px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder={t("reports.search_placeholder")}
                className="w-full pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {unassigned ? (
            <p className="text-xs text-muted-foreground">
              Chỉ gồm báo cáo đã xác minh và chưa có cán bộ. Có thể bấm{" "}
              <span className="font-medium text-foreground">Điều phối</span> để
              xem gợi ý phân công tự động hoặc mở trang chi tiết để phân công
              thủ công.
            </p>
          ) : null}
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-4 font-medium">{t("reports.col_title")}</th>
                  <th className="p-4 font-medium">
                    {t("reports.col_category")}
                  </th>
                  <th className="p-4 font-medium">
                    {t("reports.col_severity")}
                  </th>
                  <th className="p-4 font-medium">{t("reports.col_status")}</th>
                  <th className="p-4 font-medium">{t("reports.col_date")}</th>
                  <th className="p-4 text-right font-medium">
                    {t("reports.col_actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-8 text-center text-sm text-muted-foreground"
                    >
                      Không có báo cáo nào phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  filteredAlerts.map((alert: Alert) => {
                    const normalizedStatus = alert.status.toLowerCase();
                    const isRowUnassigned =
                      unassigned ||
                      (normalizedStatus === "verified" &&
                        !alert.assignedOfficerId);

                    return (
                      <tr
                        key={alert._id}
                        onClick={() => navigate(`/admin/reports/${alert._id}`)}
                        className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/50"
                      >
                        <td className="p-4 font-medium">
                          <div>{alert.title}</div>
                          {unassigned && (
                            <p className="mt-1 text-xs font-normal text-amber-500">
                              {assignmentReasonLabel(
                                alert.lastAssignmentAttempt?.reason,
                              )}
                            </p>
                          )}
                        </td>
                        <td className="p-4">
                          {getIncidentCategoryLabel(alert.category, language)}
                        </td>
                        <td className="p-4">
                          <Badge
                            variant="outline"
                            className={
                              alert.severity === "high"
                                ? "border-red-500 text-red-500"
                                : alert.severity === "medium"
                                  ? "border-orange-500 text-orange-500"
                                  : "border-blue-500 text-blue-500"
                            }
                          >
                            {getIncidentSeverityLabel(alert.severity, language)}
                          </Badge>
                        </td>
                        <td className="p-4">
                          {getIncidentStatusLabel(alert.status, language)}
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {format(new Date(alert.createdAt), "MMM d, yyyy")}
                        </td>
                        <td
                          className="p-4"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Đúng 1 nút hành động ngữ cảnh duy nhất */}
                            {isRowUnassigned ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 border-primary/40 text-xs font-medium"
                                onClick={() => setPreviewId(alert._id)}
                              >
                                <SlidersHorizontal className="h-3.5 w-3.5" />
                                Điều phối
                              </Button>
                            ) : normalizedStatus === "resolved" ? (
                              <Button
                                asChild
                                size="sm"
                                className="h-8 gap-1.5 bg-emerald-600 text-xs font-medium text-white hover:bg-emerald-700"
                              >
                                <Link to={`/admin/reports/${alert._id}`}>
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Nghiệm thu
                                </Link>
                              </Button>
                            ) : (
                              <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                              >
                                <Link to={`/admin/reports/${alert._id}`}>
                                  Chi tiết
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                              </Button>
                            )}

                            {/* Menu phụ ⋯ chứa Mở chi tiết và Xóa báo cáo */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                  aria-label="Tùy chọn khác"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onSelect={() =>
                                    navigate(`/admin/reports/${alert._id}`)
                                  }
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  Mở trang chi tiết
                                </DropdownMenuItem>
                                {normalizedStatus === "verified" && (
                                  <DropdownMenuItem
                                    onSelect={() => setPreviewId(alert._id)}
                                  >
                                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                                    Gợi ý phân công
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-500 focus:text-red-500"
                                  onSelect={() => {
                                    if (confirm("Xóa báo cáo?")) {
                                      deleteAlert.mutate(alert._id);
                                      toast.success(
                                        t("toast.report_deleted_success"),
                                      );
                                    }
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Xóa báo cáo
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end space-x-2 py-4">
            {/* về trang trước */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              {t("reports.prev")}
            </Button>
            {/* chuyển qua trang tiếp theo */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
            >
              {t("reports.next")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialog điều phối / gợi ý phân công không làm xô lệch bố cục bảng */}
      <Dialog
        open={Boolean(previewId)}
        onOpenChange={(open) => {
          if (!open) setPreviewId(undefined);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Điều phối & Gợi ý Phân công Cán bộ</DialogTitle>
            <DialogDescription>
              Kiểm tra khu vực dịch vụ GIS, ca trực hiện tại và tự động phân
              công cán bộ phù hợp.
            </DialogDescription>
          </DialogHeader>
          {previewId ? <AssignmentPreview id={previewId} /> : null}
          <DialogFooter className="gap-2 sm:justify-between">
            {previewId ? (
              <Button asChild variant="outline" size="sm">
                <Link to={`/admin/reports/${previewId}`}>
                  Mở trang chi tiết báo cáo
                </Link>
              </Button>
            ) : null}
            <DialogClose asChild>
              <Button type="button" variant="secondary" size="sm">
                Đóng
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

