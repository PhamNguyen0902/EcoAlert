import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userService } from "../api/userService";
import { CreateUserData, User } from "../types";

export const useOfficers = (enabled = true) => {
  return useQuery({
    queryKey: ["users", "officers"],
    queryFn: userService.getOfficers,
    enabled,
    staleTime: 60 * 1000,
  });
};

export const useUsers = (page = 1, limit = 10, role?: string, search?: string) => {
  return useQuery({
    queryKey: ["users", page, limit, role, search],
    queryFn: () => userService.getUsers(page, limit, role, search),
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserData) => userService.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
};

export const useChangeRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => userService.changeRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
};

export const useToggleUserStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      userService.toggleStatus(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => userService.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
};

export const useAuditLogs = (page = 1, limit = 20, search?: string) => {
  return useQuery({
    queryKey: ["audit-logs", page, limit, search],
    queryFn: () => userService.getAuditLogs(page, limit, search),
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Pick<User, "fullName" | "phone" | "avatar">>) =>
      userService.updateProfile(data),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["profile"], updatedUser);
    },
  });
};

export const useChangePassword = () => {
  return useMutation({
    mutationFn: (data: { oldPassword: string; newPassword: string }) =>
      userService.changePassword(data),
  });
};

