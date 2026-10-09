import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileCheck2,
  ShieldCheck,
  Users,
  Search,
  Filter,
  RefreshCw,
  UserCheck,
  Ban,
  TrendingUp,
  Eye,
  X,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  useAdminDashboardData,
  useAdminUsers,
  useUpdateUserRole,
  useToggleUserStatus,
} from "@/hooks/useAdminDashboard";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import toast from "react-hot-toast";
import { Alert, User } from "@/types";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getIncidentCategoryLabel,
  getIncidentSeverityLabel,
  getIncidentStatusLabel,
} from "@/lib/incident-presentation";

// các loại mục tương ứng với các thẻ
type MetricType = "valid" | "in_progress" | "pending" | "resolved";

interface MetricConfig {
  key: MetricType;
  title: string;
  description: string;
  badgeColor: string;
}

const METRIC_CONFIGS: Record<MetricType, MetricConfig> = {
  valid: {
    key: "valid",
    title: "SỰ CỐ HỢP LỆ",
    description: "Các sự cố đã qua kiểm tra, xác minh hợp lệ và đang/đã được xử lý",
    badgeColor: "border-emerald-500 text-emerald-500 bg-emerald-500/10",
  },
  in_progress: {
    key: "in_progress",
    title: "SỰ CỐ ĐANG XỬ LÝ",
    description: "Các sự cố đã được giao cho cán bộ hoặc cán bộ đang xử lý tại hiện trường",
    badgeColor: "border-amber-500 text-amber-500 bg-amber-500/10",
  },
  pending: {
    key: "pending",
    title: "SỰ CỐ CHỜ TIẾP NHẬN",
    description: "Các sự cố mới gửi đang chờ hệ thống AI phân tích hoặc chờ điều phối cán bộ",
    badgeColor: "border-blue-500 text-blue-500 bg-blue-500/10",
  },
  resolved: {
    key: "resolved",
    title: "SỰ CỐ ĐÃ GIẢI QUYẾT",
    description: "Các sự cố đã được cán bộ hoàn thành khắc phục và admin phê duyệt đóng hồ sơ",
    badgeColor: "border-purple-500 text-purple-500 bg-purple-500/10",
  },
};

export default function AdminDashboard() {
  const { language } = useLanguage();
  const [userPage, setUserPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  // state lưu mục đang được chọn khi click vào thẻ thống kê
  const [selectedMetric, setSelectedMetric] = useState<MetricType | null>(null);

  // lấy dữ liệu thống kê sự cố
  const {
    data: stats,
    isLoading: isStatsLoading,
    refetch: refetchStats,
    isRefetching: isStatsRefetching,
  } = useAdminDashboardData();

  // lấy danh sách người dùng cho phân quyền
  const { data: userData, isLoading: isUsersLoading } = useAdminUsers({
    page: userPage,
    limit: 8,
    role: roleFilter,
    search: searchTerm,
  });

  const updateRoleMutation = useUpdateUserRole();
  const toggleStatusMutation = useToggleUserStatus();

  // xử lý đổi vai trò
  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateRoleMutation.mutateAsync({ userId, role: newRole });
      toast.success(`Đã cập nhật vai trò sang ${newRole}`);
    } catch {
      toast.error("Không thể cập nhật quyền người dùng");
    }
  };

  // xử lý khóa hoặc mở tài khoản
  const handleStatusToggle = async (userId: string, currentStatus: boolean) => {
    try {
      await toggleStatusMutation.mutateAsync({
        userId,
        isActive: !currentStatus,
      });
      toast.success(
        currentStatus ? "Đã khóa tài khoản" : "Đã kích hoạt lại tài khoản",
      );
    } catch {
      toast.error("Không thể đổi trạng thái tài khoản");
    }
  };

  // hàm click vào thẻ để mở hoặc đóng bộ lọc
  const handleCardClick = (metric: MetricType) => {
    if (selectedMetric === metric) {
      setSelectedMetric(null); // click lại thẻ đang mở thì đóng lại
    } else {
      setSelectedMetric(metric); // mở danh sách mục tương ứng
    }
  };

  // lọc danh sách sự cố tương ứng theo tiêu đề hoặc chỉ số được chọn
  const filteredAlerts: Alert[] = React.useMemo(() => {
    if (!selectedMetric || !stats?.allItems) return [];
    const items = stats.allItems;

    switch (selectedMetric) {
      case "valid":
        return items.filter((a) =>
          ["verified", "assigned", "in_progress", "resolved", "closed"].includes(a.status)
        );
      case "in_progress":
        return items.filter((a) =>
          ["assigned", "in_progress"].includes(a.status)
        );
      case "pending":
        return items.filter((a) =>
          ["pending", "ai_analyzing"].includes(a.status)
        );
      case "resolved":
        return items.filter((a) =>
          ["resolved", "closed"].includes(a.status)
        );
      default:
        return [];
    }
  }, [selectedMetric, stats?.allItems]);

  return (
    <div className="space-y-8 pb-10">
      {/* phần đầu trang và tiêu đề */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Bảng Điều Khiển Quản Trị
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Theo dõi tổng quan số liệu sự cố môi trường và quản lý phân quyền thành viên hệ thống EcoAlert.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetchStats()}
          disabled={isStatsRefetching}
          className="self-start sm:self-auto gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isStatsRefetching ? "animate-spin" : ""}`} />
          Làm mới số liệu
        </Button>
      </div>

      {/* khối thống kê sự cố môi trường */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            Số liệu thống kê sự cố
          </h2>
          <span className="text-xs text-muted-foreground">
            Nhấp vào từng thẻ để xem danh sách chi tiết
          </span>
        </div>

        {isStatsLoading ? (
          <div className="h-36 flex items-center justify-center">
            <LoadingSpinner size="md" label="Đang tổng hợp số liệu..." />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* thẻ sự cố hợp lệ */}
            <div
              onClick={() => handleCardClick("valid")}
              className={`cursor-pointer transition-all duration-200 rounded-xl ${
                selectedMetric === "valid"
                  ? "ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/10 scale-[1.02]"
                  : "hover:scale-[1.01]"
              }`}
            >
              <StatCard
                title="SỰ CỐ HỢP LỆ"
                value={stats?.validIncidents ?? 0}
                icon={FileCheck2}
                description={`Chiếm ${stats?.total ? Math.round(((stats.validIncidents / stats.total) * 100)) : 0}% tổng số tin báo`}
                gradient="bg-gradient-to-br from-emerald-500/20 to-teal-500/10 text-emerald-600 dark:text-emerald-400"
              />
            </div>

            {/* thẻ sự cố đang xử lý */}
            <div
              onClick={() => handleCardClick("in_progress")}
              className={`cursor-pointer transition-all duration-200 rounded-xl ${
                selectedMetric === "in_progress"
                  ? "ring-2 ring-amber-500 shadow-lg shadow-amber-500/10 scale-[1.02]"
                  : "hover:scale-[1.01]"
              }`}
            >
              <StatCard
                title="ĐANG XỬ LÝ"
                value={stats?.inProgressIncidents ?? 0}
                icon={Clock}
                description="Cán bộ đã nhận việc hoặc đang tại hiện trường"
                gradient="bg-gradient-to-br from-amber-500/20 to-orange-500/10 text-amber-600 dark:text-amber-400"
              />
            </div>

            {/* thẻ sự cố chờ tiếp nhận */}
            <div
              onClick={() => handleCardClick("pending")}
              className={`cursor-pointer transition-all duration-200 rounded-xl ${
                selectedMetric === "pending"
                  ? "ring-2 ring-blue-500 shadow-lg shadow-blue-500/10 scale-[1.02]"
                  : "hover:scale-[1.01]"
              }`}
            >
              <StatCard
                title="CHỜ TIẾP NHẬN"
                value={stats?.pendingIncidents ?? 0}
                icon={AlertTriangle}
                description="Báo cáo mới đang chờ phân công hoặc xác minh"
                gradient="bg-gradient-to-br from-blue-500/20 to-cyan-500/10 text-blue-600 dark:text-blue-400"
              />
            </div>

            {/* thẻ sự cố đã giải quyết */}
            <div
              onClick={() => handleCardClick("resolved")}
              className={`cursor-pointer transition-all duration-200 rounded-xl ${
                selectedMetric === "resolved"
                  ? "ring-2 ring-purple-500 shadow-lg shadow-purple-500/10 scale-[1.02]"
                  : "hover:scale-[1.01]"
              }`}
            >
              <StatCard
                title="ĐÃ GIẢI QUYẾT"
                value={stats?.resolvedIncidents ?? 0}
                icon={CheckCircle2}
                description={`Tỷ lệ hoàn tất xử lý: ${stats?.resolutionRate ?? 0}%`}
                gradient="bg-gradient-to-br from-purple-500/20 to-indigo-500/10 text-purple-600 dark:text-purple-400"
              />
            </div>
          </div>
        )}

        {/* bảng danh sách chi tiết hiển thị khi bấm vào thẻ */}
        <AnimatePresence>
          {selectedMetric && (
            <motion.div
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="border border-primary/20 shadow-md">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`font-semibold ${METRIC_CONFIGS[selectedMetric].badgeColor}`}>
                        {METRIC_CONFIGS[selectedMetric].title}
                      </Badge>
                      <span className="text-sm font-semibold text-foreground">
                        ({filteredAlerts.length} sự cố)
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {METRIC_CONFIGS[selectedMetric].description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="text-xs gap-1.5"
                    >
                      <Link to="/admin/reports">
                        Xem tất cả tại Quản lý báo cáo
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedMetric(null)}
                      className="h-8 w-8 p-0"
                      title="Đóng bảng"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                          <th className="p-3 font-medium">Tiêu đề sự cố</th>
                          <th className="p-3 font-medium">Danh mục</th>
                          <th className="p-3 font-medium">Mức độ</th>
                          <th className="p-3 font-medium">Trạng thái</th>
                          <th className="p-3 font-medium">Thời gian</th>
                          <th className="p-3 font-medium text-right">Chi tiết</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAlerts.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-muted-foreground">
                              Không có sự cố nào thuộc mục này.
                            </td>
                          </tr>
                        ) : (
                          filteredAlerts.map((alert: Alert) => (
                            <tr
                              key={alert._id}
                              className="border-b last:border-0 hover:bg-muted/40 transition-colors"
                            >
                              <td className="p-3 font-medium">
                                <div className="max-w-[280px] truncate" title={alert.title}>
                                  {alert.title}
                                </div>
                                <div className="text-xs text-muted-foreground max-w-[280px] truncate">
                                  {alert.address || "Chưa có địa chỉ cụ thể"}
                                </div>
                              </td>

                              <td className="p-3 text-xs">
                                {getIncidentCategoryLabel(alert.category, language)}
                              </td>

                              <td className="p-3">
                                <Badge
                                  variant="outline"
                                  className={
                                    alert.severity === "critical"
                                      ? "border-red-600 text-red-600 bg-red-500/10"
                                      : alert.severity === "high"
                                      ? "border-red-500 text-red-500"
                                      : alert.severity === "medium"
                                      ? "border-orange-500 text-orange-500"
                                      : "border-blue-500 text-blue-500"
                                  }
                                >
                                  {getIncidentSeverityLabel(alert.severity, language)}
                                </Badge>
                              </td>

                              <td className="p-3 text-xs">
                                <Badge variant="secondary" className="font-normal">
                                  {getIncidentStatusLabel(alert.status, language)}
                                </Badge>
                              </td>

                              <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                                {alert.createdAt
                                  ? format(new Date(alert.createdAt), "dd/MM/yyyy HH:mm")
                                  : "---"}
                              </td>

                              <td className="p-3 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  asChild
                                  className="h-8 px-2 text-xs"
                                >
                                  <Link to={`/admin/reports/${alert._id}`}>
                                    <Eye className="h-3.5 w-3.5 mr-1" />
                                    Xem
                                  </Link>
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* thanh trực quan phân bổ mức độ nghiêm trọng */}
        {stats && (
          <Card className="p-4 bg-muted/40 border">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
              Mức độ nghiêm trọng các sự cố đang quản lý
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex items-center justify-between p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                  Khẩn cấp (Critical)
                </span>
                <Badge variant="destructive">{stats.severityCounts.critical}</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                  Cao (High)
                </span>
                <Badge className="bg-orange-500">{stats.severityCounts.high}</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">
                  Trung bình (Medium)
                </span>
                <Badge className="bg-yellow-500 text-black">{stats.severityCounts.medium}</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  Thấp (Low)
                </span>
                <Badge variant="outline">{stats.severityCounts.low}</Badge>
              </div>
            </div>
          </Card>
        )}
      </section>

      {/* khối quản lý và phân quyền người dùng */}
      <section className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Quản lý & Phân quyền thành viên
          </h2>
          <span className="text-xs text-muted-foreground">
            Quyền hạn: Admin, Cán bộ (Officer), Người dân (Citizen)
          </span>
        </div>

        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Danh sách tài khoản ({userData?.total ?? 0})
            </CardTitle>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Tìm email, họ tên..."
                  className="pl-8 h-9 w-[200px] sm:w-[240px]"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setUserPage(1);
                  }}
                />
              </div>

              <div className="flex items-center gap-1 bg-muted p-1 rounded-md text-xs">
                <Filter className="h-3 w-3 text-muted-foreground ml-1" />
                {(["ALL", "ADMIN", "OFFICER", "CITIZEN"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      setRoleFilter(r);
                      setUserPage(1);
                    }}
                    className={`px-2 py-1 rounded transition-colors ${
                      roleFilter === r
                        ? "bg-background text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {r === "ALL" ? "Tất cả" : r}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isUsersLoading ? (
              <div className="py-12 flex justify-center">
                <LoadingSpinner size="md" label="Đang tải danh sách người dùng..." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground uppercase">
                      <th className="py-3 px-4 font-semibold">Thành viên</th>
                      <th className="py-3 px-4 font-semibold">Email</th>
                      <th className="py-3 px-4 font-semibold">Vai trò hiện tại</th>
                      <th className="py-3 px-4 font-semibold">Trạng thái</th>
                      <th className="py-3 px-4 font-semibold text-right">Thao tác phân quyền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!userData?.items || userData.items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                          Không tìm thấy người dùng phù hợp.
                        </td>
                      </tr>
                    ) : (
                      userData.items.map((user: User) => (
                        <tr
                          key={user._id}
                          className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div className="font-medium text-foreground">{user.fullName || "Chưa đặt tên"}</div>
                            <div className="text-xs text-muted-foreground">{user.phone || "Không có SĐT"}</div>
                          </td>

                          <td className="py-3 px-4 font-mono text-xs">{user.email}</td>

                          <td className="py-3 px-4">
                            <Badge
                              variant="outline"
                              className={
                                user.role === "ADMIN"
                                  ? "border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-500/10 font-bold"
                                  : user.role === "OFFICER"
                                  ? "border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-500/10 font-bold"
                                  : "border-slate-400 text-slate-600 dark:text-slate-400 bg-slate-500/10"
                              }
                            >
                              {user.role}
                            </Badge>
                          </td>

                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                                user.isActive
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  user.isActive ? "bg-emerald-500" : "bg-rose-500"
                                }`}
                              />
                              {user.isActive ? "Hoạt động" : "Bị khóa"}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <select
                                value={user.role}
                                onChange={(e) => handleRoleChange(user._id, e.target.value)}
                                disabled={updateRoleMutation.isPending}
                                className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium shadow-xs focus:ring-1 focus:ring-primary cursor-pointer"
                              >
                                <option value="CITIZEN">Dân (CITIZEN)</option>
                                <option value="OFFICER">Cán bộ (OFFICER)</option>
                                <option value="ADMIN">Quản trị (ADMIN)</option>
                              </select>

                              <Button
                                size="sm"
                                variant={user.isActive ? "outline" : "default"}
                                className={`h-8 px-2 text-xs gap-1 ${
                                  user.isActive
                                    ? "text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                                }`}
                                onClick={() => handleStatusToggle(user._id, user.isActive)}
                                disabled={toggleStatusMutation.isPending}
                                title={user.isActive ? "Khóa tài khoản này" : "Kích hoạt lại tài khoản"}
                              >
                                {user.isActive ? (
                                  <>
                                    <Ban className="h-3.5 w-3.5" />
                                    Khóa
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="h-3.5 w-3.5" />
                                    Mở
                                  </>
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {userData && userData.totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t text-xs text-muted-foreground">
                <span>
                  Trang {userData.page} / {userData.totalPages} (Tổng cộng {userData.total} tài khoản)
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={userPage <= 1}
                    onClick={() => setUserPage((prev) => Math.max(1, prev - 1))}
                  >
                    Trước
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={userPage >= userData.totalPages}
                    onClick={() => setUserPage((prev) => prev + 1)}
                  >
                    Sau
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}