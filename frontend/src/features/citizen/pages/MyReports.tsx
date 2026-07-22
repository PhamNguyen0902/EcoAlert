import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAlerts, useDeleteAlert } from "@/hooks/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Search, Eye, FileText, Plus, Trash2, Pencil } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import type { Alert } from "@/types";
import EditReportModal from "../components/EditReportModal";

const severityColor: Record<string, string> = {
  critical: "destructive",
  high: "warning",
  medium: "default",
  low: "secondary",
};

const statusColor = (status: string) =>
  ["resolved", "closed"].includes(status)
    ? ("success" as const)
    : ("outline" as const);

export default function MyReports() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);

  // Hook lấy danh sách báo cáo & Hook xóa báo cáo
  const { data: alertsData, isLoading } = useAlerts(
    page,
    10,
    search ? { title: search } : {},
  );
  const deleteAlertMutation = useDeleteAlert();

  if (isLoading)
    return <LoadingSpinner size="lg" label="Loading your reports..." />;

  const alerts: Alert[] = alertsData?.items || [];
  const total = alertsData?.total || 0;
  const totalPages = Math.ceil(total / 10);

  // Hàm xử lý Xóa / Hủy báo cáo
  const handleDelete = (id: string, status: string) => {
    if (status !== "pending" && status !== "ai_analyzing") {
      toast.error("Chỉ có thể xóa báo cáo khi đang ở trạng thái chờ duyệt!");
      return;
    }

    if (
      window.confirm("Bạn có chắc chắn muốn hủy / xóa bài báo cáo này không?")
    ) {
      deleteAlertMutation.mutate(id, {
        onSuccess: () => {
          toast.success("Đã xóa báo cáo thành công!");
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.message || "Xóa báo cáo thất bại.");
        },
      });
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Reports</h1>
          <p className="text-muted-foreground mt-1">
            Track and manage your environmental incident reports
          </p>
        </div>
        <Button asChild>
          <Link to="/report" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Report
          </Link>
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search your reports..."
          className="pl-9 bg-muted/50"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {alerts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No reports yet"
          description="You haven't submitted any environmental incident reports."
          action={{
            label: "Create Your First Report",
            onClick: () => navigate("/report"),
          }}
        />
      ) : (
        <div className="space-y-3">
          {alerts.map((alert, i) => {
            const canEditOrDelete =
              alert.status === "pending" || alert.status === "ai_analyzing";

            return (
              <motion.div
                key={alert._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-start gap-4">
                      {alert.mediaUrls?.[0] && (
                        <div className="hidden sm:block w-20 h-20 rounded-xl overflow-hidden shrink-0">
                          <img
                            src={alert.mediaUrls[0]}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            to={`/incidents/${alert._id}`}
                            className="font-semibold text-lg hover:text-primary transition-colors truncate"
                          >
                            {alert.title}
                          </Link>
                          <div className="flex gap-1.5 shrink-0">
                            <Badge
                              variant={severityColor[alert.severity] as any}
                            >
                              {alert.severity?.toUpperCase()}
                            </Badge>
                            <Badge variant={statusColor(alert.status)}>
                              {alert.status?.replace(/_/g, " ").toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                          {alert.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>
                            {format(
                              new Date(alert.createdAt),
                              "MMM dd, yyyy HH:mm",
                            )}
                          </span>
                          {alert.address && <span>• {alert.address}</span>}
                          {alert.category && (
                            <span>• {alert.category.replace(/_/g, " ")}</span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons: View, Edit, Delete */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          title="View Details"
                        >
                          <Link to={`/incidents/${alert._id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>

                        {canEditOrDelete && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                              onClick={() => setEditingAlert(alert)}
                              title="Edit Report"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                              onClick={() =>
                                handleDelete(alert._id, alert.status)
                              }
                              disabled={deleteAlertMutation.isPending}
                              title="Delete / Cancel Report"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} reports)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {editingAlert && (
        <EditReportModal
          alert={editingAlert}
          isOpen={!!editingAlert}
          onClose={() => setEditingAlert(null)}
        />
      )}
    </div>
  );
}
