import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { alertService } from "../services/services";
import { userService, UserFilters } from "../services/userService";
import { Alert } from "@/types";

export const useAdminDashboardData  = () => {
  //lấy danh sách sự cố gần nhất để tính toán số liệu thống kê thời gian thực
  return useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async () => {
      //lấy tối đa 100 sự cố gần nhất để thống kê
      const alertData = await alertService.getAlerts(1, 100);
      const items: Alert[] = alertData?.items || [];

      const total = items.length;

      // số sự cố hợp lệ: Đã qua thẩm định hoặc đang/đã giải quyết (loại bỏ rejected và pending chưa xử lý)
      const validIncidents = items.filter((a) =>
        ["verified", "assigned", "in_progress", "resolved", "closed"].includes(
          a.status,
        ),
      ).length;
      // số sự cố đang xử lý: Đã phân công hoặc cán bộ đang thực hiện tại hiện trường
      const inProgressIncidents = items.filter((a) =>
        ["assigned", "in_progress"].includes(a.status),
      ).length;
      // số sự cố chờ thẩm định / tiếp nhận mới
      const pendingIncidents = items.filter((a) =>
        ["pending", "ai_analyzing"].includes(a.status),
      ).length;
      // số sự cố đã giải quyết thành công
      const resolvedIncidents = items.filter((a) =>
        ["resolved", "closed"].includes(a.status),
      ).length;
      // thống kê theo mức độ nghiêm trọng
      const severityCounts = {
        critical: items.filter((a) => a.severity === "critical").length,
        high: items.filter((a) => a.severity === "high").length,
        medium: items.filter((a) => a.severity === "medium").length,
        low: items.filter((a) => a.severity === "low").length,
      };
      // tỷ lệ giải quyết sự cố hợp lệ (%)
      const resolutionRate =
        validIncidents > 0
          ? Math.round((resolvedIncidents / validIncidents) * 100)
          : 0;
      return {
        total,
        validIncidents,
        inProgressIncidents,
        pendingIncidents,
        resolvedIncidents,
        resolutionRate,
        severityCounts,
        recentAlerts: items.slice(0, 5),
        allItems: items,
      };
    },
    refetchInterval: 20000, // Tự động làm mới mỗi 20 giây
  });
};
//hook quản lý danh sách người dùng cho phân quyền
export const useAdminUsers = (filters: UserFilters) => {
  return useQuery({
    queryKey: ["admin-users", filters],
    queryFn: () => userService.getUsers(filters),
  });
};
//hook thao tác đối quyền
export const useUpdateUserRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      userService.changeRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
};
//hook thao tác khóa / mở tài khoản
export const useToggleUserStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      userService.toggleStatus(userId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
};
