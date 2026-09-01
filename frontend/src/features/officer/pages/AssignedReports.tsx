import { useState } from "react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  ClipboardList,
  MapPin,
  RefreshCw,
  Search,
} from "lucide-react";
import { useOfficerTasks } from "@/hooks/hooks";
import { Alert, AlertStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { getApiErrorMessage } from "@/lib/api-error";

const PAGE_LIMIT = 9;
type TaskTab = "assigned" | "in_progress" | "resolved" | "all";

const TASK_TABS: Array<{ value: TaskTab; label: string }> = [
  { value: "assigned", label: "Đã phân công" },
  { value: "in_progress", label: "Đang xử lý" },
  { value: "resolved", label: "Đã giải quyết" },
  { value: "all", label: "Tất cả nhiệm vụ" },
];

const severityClasses: Record<string, string> = {
  critical: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  high: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  medium:
    "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  low: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

const statusClasses: Partial<Record<AlertStatus, string>> = {
  assigned: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  in_progress: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  resolved: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  closed: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

export default function AssignedReports() {
  const [activeTab, setActiveTab] = useState<TaskTab>("assigned");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const status = activeTab === "all" ? undefined : activeTab;
  const { data, isLoading, isError, error, refetch, isFetching } =
    useOfficerTasks(page, PAGE_LIMIT, status);

  const tasks = data?.items ?? [];
  // lọc danh sách nhiệm vụ trên client theo từ khóa
  const visibleTasks = search.trim()
    ? tasks.filter((task) => {
        const query = search.trim().toLowerCase();
        return (
          task.title.toLowerCase().includes(query) ||
          task.address?.toLowerCase().includes(query)
        );
      })
    : tasks; // không tìm thấy task thì giữ nguyên danh sách gốc
  const total = data?.total ?? 0;
  const totalPages = Math.max(
    1,
    data?.totalPages ?? Math.ceil(total / PAGE_LIMIT),
  );

  const selectTab = (tab: TaskTab) => {
    setActiveTab(tab);
    setPage(1);
    setSearch("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Báo cáo được giao
          </h1>
          <p className="mt-1 text-muted-foreground">
            Các sự cố được phân công cho tài khoản Cán bộ của bạn.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
          />
          Làm mới
        </Button>
      </div>

      <div
        className="flex gap-1 overflow-x-auto rounded-xl border bg-muted/30 p-1"
        role="tablist"
        aria-label="Trạng thái nhiệm vụ"
      >
        {TASK_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.value}
            onClick={() => selectTab(tab.value)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm kiếm trang hiện tại theo tiêu đề hoặc địa chỉ"
            className="pl-9"
          />
        </div>
        <p className="text-sm text-muted-foreground">{total} nhiệm vụ</p>
      </div>

      {isLoading ? (
        <LoadingSpinner
          className="mx-auto my-20"
          label="Đang tải các nhiệm vụ được phân công..."
        />
      ) : isError ? (
        <Card className="border-destructive/40">
          <CardContent className="space-y-3 py-10 text-center">
            <p className="font-medium text-destructive">
              Không thể tải các nhiệm vụ được phân công.
            </p>
            <p className="text-sm text-muted-foreground">
              {getApiErrorMessage(
                error,
                "Vui lòng kiểm tra kết nối và thử lại.",
              )}
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              Thử lại
            </Button>
          </CardContent>
        </Card>
      ) : visibleTasks.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={search ? "Không có nhiệm vụ nào phù hợp" : "Chưa có nhiệm vụ"}
          description={
            search
              ? "Thử tìm kiếm với từ khóa khác."
              : "Nhiệm vụ sẽ xuất hiện ở đây khi quy trình đạt đến trạng thái này."
          }
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleTasks.map((task: Alert) => (
            <Card
              key={task._id}
              className="group overflow-hidden border-border/70 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              {/* ảnh báo cáo hoặc placeholder khi kh có ảnh */}
              <div className="relative aspect-[16/8] bg-muted">
                {task.mediaUrls?.[0] ? (
                  <img
                    src={task.mediaUrls[0]}
                    alt="Hình ảnh sự cố từ người dân"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Không có hình ảnh sự cố
                  </div>
                )}
                {/* badge trạng thái và mực độ */}
                <Badge
                  className={`absolute left-3 top-3 border-0 capitalize ${statusClasses[task.status] || ""}`}
                >
                  {task.status.replace(/_/g, " ")}
                </Badge>
                <Badge
                  variant="outline"
                  className={`absolute right-3 top-3 capitalize backdrop-blur ${severityClasses[task.severity ?? "low"] || ""}`}
                >
                  {task.severity ?? "không xác định"}
                </Badge>
              </div>
              <CardContent className="space-y-4 p-5">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
                    {task.category.replace(/_/g, " ")}
                  </p>
                  <h2 className="line-clamp-2 text-lg font-semibold">
                    {task.title}
                  </h2>
                </div>
                <p className="flex min-h-10 items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="line-clamp-2">
                    {task.address || "Không có địa chỉ"}
                  </span>
                </p>
                {/* thời gian tạo và giao việc */}
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Thời gian tạo</p>
                    <p className="mt-1 font-medium">
                      {format(new Date(task.createdAt), "PP")}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Thời gian giao</p>
                    <p className="mt-1 font-medium">
                      {task.assignedAt
                        ? format(new Date(task.assignedAt), "PP")
                        : "Nhiệm vụ đã phân công"}
                    </p>
                  </div>
                </div>
                {/* nút bấm mở chi tiết alert dẫn tới report detail */}
                <Button asChild className="w-full">
                  <Link to={`/officer/reports/${task._id}`}>
                    <CalendarDays className="mr-2 h-4 w-4" />
                    Mở nhiệm vụ
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && !isError && totalPages > 1 ? (
        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Trang {page} / {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Trước
            </Button>
            <Button
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Tiếp
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
