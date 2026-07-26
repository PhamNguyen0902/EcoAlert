import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authService } from "../api/authService";
import { LoginCredentials, RegisterData } from "../types";
import { storage } from "../utils/storage";

export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authService.login(credentials),
    onSuccess: (data) => {
      if (data.user) {
        queryClient.setQueryData(["profile"], data.user);
      }
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
};

export const useRegister = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RegisterData) => authService.register(data),
    onSuccess: (data) => {
      if (data.user) {
        queryClient.setQueryData(["profile"], data.user);
      }
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      queryClient.setQueryData(["profile"], null);
      queryClient.removeQueries({ queryKey: ["profile"] });
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
        const remoteUser = await authService.getProfile();
        return remoteUser;
      } catch (e) {
        // Fallback to locally saved user in storage if API call fails
        const localUser = await storage.getUser();
        if (localUser) return localUser;
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
