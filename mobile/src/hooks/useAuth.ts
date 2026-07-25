import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authService } from "../api/authService";
import { LoginCredentials, RegisterData } from "../types";
import { storage } from "../utils/storage";

export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authService.login(credentials),
    onSuccess: (data) => {
      queryClient.setQueryData(["profile"], data.user);
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
};

export const useRegister = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RegisterData) => authService.register(data),
    onSuccess: (data) => {
      queryClient.setQueryData(["profile"], data.user);
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      queryClient.clear();
    },
  });
};

export const useProfile = () => {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const token = await storage.getToken();
      if (!token) return null;
      try {
        return await authService.getProfile();
      } catch (e) {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
