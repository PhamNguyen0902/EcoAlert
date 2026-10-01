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
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const token = await storage.getToken();
      if (!token) return null;

      // Render from the securely cached session first. This keeps Expo Go usable
      // while a phone is reconnecting to a LAN-hosted API Gateway.
      const localUser = await storage.getUser();
      if (localUser) {
        void authService.getProfile()
          .then((remoteUser) => queryClient.setQueryData(["profile"], remoteUser))
          .catch(() => undefined);
        return localUser;
      }

      try {
        return await authService.getProfile();
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });
};
