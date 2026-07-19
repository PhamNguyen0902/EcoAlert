import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertService, notificationService, authService } from '../services/services';

// Auth Hooks
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

// Alert Hooks
export const useAlerts = (page = 1, limit = 10, filters = {}) => {
  return useQuery({
    queryKey: ['alerts', page, limit, filters],
    queryFn: () => alertService.getAlerts(page, limit, filters),
  });
};

export const useAlert = (id: string) => {
  return useQuery({
    queryKey: ['alert', id],
    queryFn: () => alertService.getAlert(id),
    enabled: !!id,
  });
};

export const useCreateAlert = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: alertService.createAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    }
  });
};

export const useUpdateAlertStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string, status: string }) => alertService.updateStatus(id, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['alert', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    }
  });
};

// Notification Hooks
export const useNotifications = (page = 1, limit = 20) => {
  return useQuery({
    queryKey: ['notifications', page, limit],
    queryFn: () => notificationService.getNotifications(page, limit),
    refetchInterval: 30000, // auto-refresh every 30s
  });
};

export const useUnreadCount = () => {
  return useQuery({
    queryKey: ['notifications', 'unreadCount'],
    queryFn: () => notificationService.getUnreadCount(),
    refetchInterval: 15000,
  });
};

export const useMarkAsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationService.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });
};

export const useMarkAllAsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationService.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });
};
