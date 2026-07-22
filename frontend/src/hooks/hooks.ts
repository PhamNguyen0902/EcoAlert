import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  authService,
  alertService,
  notificationService,
  userService,
  gisService,
} from "../services/services";

// ========================
// AUTH
// ========================

export const useLogin = () => {
  return useMutation({
    mutationFn: authService.login,
  });
};

export const useRegister = () => {
  return useMutation({
    mutationFn: authService.register,
  });
};

// ========================
// ALERT
// ========================

export const useAlerts = (
  page = 1,
  limit = 10,
  filters: Record<string, string> = {}
) => {
  return useQuery({
    queryKey: ["alerts", page, limit, filters],
    queryFn: () => alertService.getAlerts(page, limit, filters),
  });
};

export const useAlert = (id: string) => {
  return useQuery({
    queryKey: ["alert", id],
    queryFn: () => alertService.getAlert(id),
    enabled: !!id,
  });
};

export const useCreateAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: alertService.createAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["alerts"],
      });
    },
  });
};

export const useUpdateAlertStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: string;
    }) => alertService.updateStatus(id, status),

    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["alert", variables.id],
      });

      queryClient.invalidateQueries({
        queryKey: ["alerts"],
      });
    },
  });
};

export const useDeleteAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: alertService.deleteAlert,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["alerts"],
      });
    },
  });
};

// ========================
// NOTIFICATION
// ========================

export const useNotifications = (page = 1, limit = 20) => {
  return useQuery({
    queryKey: ["notifications", page, limit],
    queryFn: () => notificationService.getNotifications(page, limit),
    refetchInterval: 30000,
  });
};

export const useUnreadCount = () => {
  return useQuery({
    queryKey: ["notifications", "unreadCount"],
    queryFn: notificationService.getUnreadCount,
    refetchInterval: 15000,
  });
};

export const useMarkAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: notificationService.markAsRead,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["notifications"],
      });
    },
  });
};

export const useMarkAllAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: notificationService.markAllAsRead,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["notifications"],
      });
    },
  });
};

// ========================
// USER
// ========================

export const useProfile = () => {
  return useQuery({
    queryKey: ["profile"],
    queryFn: userService.getProfile,
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: userService.updateProfile,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["profile"],
      });
    },
  });
};

export const useUsers = (page = 1, limit = 10) => {
  return useQuery({
    queryKey: ["users", page, limit],
    queryFn: () => userService.getUsers(page, limit),
  });
};

export const useChangeRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      role,
    }: {
      id: string;
      role: string;
    }) => userService.changeRole(id, role),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["users"],
      });
    },
  });
};

export const useToggleUserStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      isActive,
    }: {
      id: string;
      isActive: boolean;
    }) => userService.toggleStatus(id, isActive),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["users"],
      });
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: userService.deleteUser,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["users"],
      });
    },
  });
};

// ========================
// GIS
// ========================

export const useNearbyIncidents = (
  lng: number,
  lat: number,
  maxDistance = 5000
) => {
  return useQuery({
    queryKey: ["gis", "nearby", lng, lat, maxDistance],
    queryFn: () => gisService.getNearby(lng, lat, maxDistance),
    enabled: Boolean(lng && lat),
  });
};