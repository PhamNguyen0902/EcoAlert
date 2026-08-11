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
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { t } = useLanguage();
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
    return <LoadingSpinner size="lg" label="Loading..." />;

  const alerts: Alert[] = alertsData?.items || [];
  const total = alertsData?.total || 0;
  const totalPages = Math.ceil(total / 10);

  // Hàm xử lý Xóa / Hủy báo cáo
  const handleDelete = (id: string, status: string) => {
    if (status !== "pending" && status !== "ai_analyzing") {
      toast.error(t("toast.delete_pending_only"));
      return;
    }

    if (
      window.confirm(t('my_reports.delete_confirm_desc'))
    ) {
      deleteAlertMutation.mutate(id, {
        onSuccess: () => {
          toast.success(t("toast.report_deleted_success"));
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.message || t("toast.report_delete_failed"));
        },
      });
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('my_reports.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('my_reports.subtitle')}
          </p>
        </div>
        <Button asChild>
          <Link to="/report" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {t('my_reports.btn_create')}
          </Link>
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('btn.search')}
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
          title={t('my_reports.empty')}
          description={t('my_reports.empty_desc')}
          action={{
            label: t('my_reports.btn_create'),
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
                              variant={severityColor[alert.severity ?? 'low'] as any}
                            >
                              {alert.severity?.toUpperCase() ?? 'UNAVAILABLE'}
                            </Badge>
                            <Badge variant={statusColor(alert.status)}>
                              {t(`status.${alert.status}`) !== `status.${alert.status}`
                                ? t(`status.${alert.status}`)
                                : alert.status?.replace(/_/g, " ").toUpperCase()}
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
                          title={t('btn.view')}
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
                              title={t('btn.edit')}
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
                              title={t('btn.delete')}
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
            Page {page} / {totalPages} ({total})
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {t('btn.back')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('btn.next')}
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
