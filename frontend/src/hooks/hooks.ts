import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authService, alertService, gisService } from "../services/services";
import { CreateAlertData, ResolutionInput } from "@/types";


// nhóm hook xác thực người dùng


// hook đăng nhập tài khoản
export const useLogin = () => {
  return useMutation({
    mutationFn: authService.login,
  });
};

// hook đăng ký tài khoản mới
export const useRegister = () => {
  return useMutation({
    mutationFn: authService.register,
  });
};


// nhóm hook quản lý sự cố và báo cáo


// hook lấy danh sách sự cố có phân trang và bộ lọc
export const useAlerts = (
  page = 1,
  limit = 10,
  filters: Record<string, string> = {},
) => {
  return useQuery({
    queryKey: ["alerts", page, limit, filters],
    queryFn: () => alertService.getAlerts(page, limit, filters),
  });
};

// hook lấy thông tin chi tiết một sự cố theo mã định danh
export const useAlert = (id: string) => {
  return useQuery({
    queryKey: ["alert", id],
    queryFn: () => alertService.getAlert(id),
    enabled: !!id,
    // tự động làm mới khi sự cố đang chờ trí tuệ nhân tạo phân tích
    refetchInterval: (query) => {
      const alert = query.state.data;
      const analysisPending =
        alert &&
        (alert.status === "pending" || alert.status === "ai_analyzing") &&
        alert.category === "UNCLASSIFIED" &&
        alert.aiConfidence === undefined;
      return analysisPending ? 3000 : false;
    },
  });
};

// hook lấy danh sách nhiệm vụ được giao của cán bộ
export const useOfficerTasks = (page = 1, limit = 10, status?: string) => {
  return useQuery({
    queryKey: ["officer-tasks", page, limit, status || "all"],
    queryFn: () => alertService.getOfficerTasks(page, limit, status),
  });
};

// hàm xóa bộ nhớ đệm để làm mới dữ liệu quy trình sự cố
const invalidateAlertWorkflow = (
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
) => {
  queryClient.invalidateQueries({ queryKey: ["alert", id] });
  queryClient.invalidateQueries({ queryKey: ["alerts"] });
  queryClient.invalidateQueries({ queryKey: ["officer-tasks"] });
};

// hook phân công cán bộ xử lý sự cố
export const useAssignOfficer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, officerId }: { id: string; officerId: string }) =>
      alertService.assignOfficer(id, officerId),
    onSuccess: (_, variables) =>
      invalidateAlertWorkflow(queryClient, variables.id),
  });
};

// hook lấy danh sách cán bộ và tình trạng phân công việc
export const useOfficerAvailability = (enabled = true) =>
  useQuery({
    queryKey: ["officer-availability"],
    queryFn: () => alertService.getOfficerAvailability(),
    enabled,
    staleTime: 30_000,
  });

// hook bắt đầu xử lý nhiệm vụ của cán bộ
export const useStartHandling = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: alertService.startHandling,
    onSuccess: (_, id) => invalidateAlertWorkflow(queryClient, id),
  });
};

// hook cán bộ xác nhận đã đến vị trí hiện trường
export const useConfirmArrival = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      location,
    }: {
      id: string;
      location?: { latitude?: number; longitude?: number; accuracy?: number };
    }) => alertService.confirmArrival(id, location),
    onSuccess: (_, variables) =>
      invalidateAlertWorkflow(queryClient, variables.id),
  });
};

// hook nộp kết quả và hoàn tất xử lý sự cố
export const useResolveIncident = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ResolutionInput }) =>
      alertService.resolveIncident(id, data),
    onSuccess: (_, variables) =>
      invalidateAlertWorkflow(queryClient, variables.id),
  });
};

// hook quản trị viên đóng sự cố đã giải quyết
export const useCloseIncident = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reviewNote }: { id: string; reviewNote?: string }) =>
      alertService.closeIncident(id, reviewNote),
    onSuccess: (_, variables) =>
      invalidateAlertWorkflow(queryClient, variables.id),
  });
};

// hook tạo báo cáo sự cố mới từ người dân
export const useCreateAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: alertService.createAlert,
    onSuccess: () => {
      // làm mới danh sách sự cố sau khi tạo thành công
      queryClient.invalidateQueries({
        queryKey: ["alerts"],
      });
    },
  });
};

// hook cập nhật trạng thái sự cố
export const useUpdateAlertStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      alertService.updateStatus(id, status),

    onSuccess: (_, variables) => {
      // làm mới chi tiết và danh sách sự cố
      queryClient.invalidateQueries({
        queryKey: ["alert", variables.id],
      });

      queryClient.invalidateQueries({
        queryKey: ["alerts"],
      });
    },
  });
};

// hook xóa báo cáo sự cố
export const useDeleteAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: alertService.deleteAlert,

    onSuccess: () => {
      // làm mới danh sách sau khi xóa
      queryClient.invalidateQueries({
        queryKey: ["alerts"],
      });
    },
  });
};

// hook khôi phục báo cáo sự cố đã xóa
export const useRestoreAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: alertService.restoreAlert,

    onSuccess: () => {
      // làm mới danh sách sau khi khôi phục
      queryClient.invalidateQueries({
        queryKey: ["alerts"],
      });
    },
  });
};

// hook cập nhật nội dung thông tin sự cố
export const useUpdateAlert = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreateAlertData>;
    }) => alertService.updateAlert(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["alert", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
};

// hook thêm ghi chú cán bộ vào sự cố
export const useAddOfficerNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      alertService.addOfficerNote(id, note),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["alert", variables.id] });
    },
  });
};

// ========================
// nhóm hook bản đồ và định vị không gian
// ========================

// hook tìm kiếm các sự cố lân cận theo tọa độ và bán kính
export const useNearbyIncidents = (
  lng: number,
  lat: number,
  maxDistance = 5000,
) => {
  return useQuery({
    queryKey: ["gis", "nearby", lng, lat, maxDistance],
    queryFn: () => gisService.getNearby(lng, lat, maxDistance),
    enabled: Boolean(lng && lat),
  });
};