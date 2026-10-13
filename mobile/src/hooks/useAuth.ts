import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authService } from "../api/authService";
import { LoginCredentials, RegisterData } from "../types";
import { storage } from "../utils/storage";
import type { QueryClient } from "@tanstack/react-query";
import type { User } from "../types";

// Keep the observed profile query alive: removing it can orphan RootNavigator
// while a subsequent login writes the new session to a different query instance.
export const clearAuthQueryCache = (queryClient: QueryClient) => {
  void queryClient.cancelQueries();
  queryClient.setQueryData<User | null>(["profile"], null);
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== "profile",
  });
};

export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authService.login(credentials),
    onMutate: () =>
      queryClient.cancelQueries({ queryKey: ["profile"], exact: true }),
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
    onMutate: () =>
      queryClient.cancelQueries({ queryKey: ["profile"], exact: true }),
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
      clearAuthQueryCache(queryClient);
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
          .then(async (remoteUser) => {
            if (token === (await storage.getToken()))
              queryClient.setQueryData(["profile"], remoteUser);
          })
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
