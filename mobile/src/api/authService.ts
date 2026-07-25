import { api } from "./client";
import { LoginCredentials, RegisterData, User } from "../types";
import { storage } from "../utils/storage";

export const authService = {
  login: async (credentials: LoginCredentials) => {
    const res = await api.post("/v1/auth/login", credentials);
    const { accessToken, refreshToken, user } = res.data?.data || res.data;
    if (accessToken) await storage.setToken(accessToken);
    if (refreshToken) await storage.setRefreshToken(refreshToken);
    if (user) await storage.setUser(user);
    return { accessToken, refreshToken, user };
  },

  register: async (data: RegisterData) => {
    const res = await api.post("/v1/auth/register", data);
    const { accessToken, refreshToken, user } = res.data?.data || res.data;
    if (accessToken) await storage.setToken(accessToken);
    if (refreshToken) await storage.setRefreshToken(refreshToken);
    if (user) await storage.setUser(user);
    return { accessToken, refreshToken, user };
  },

  logout: async () => {
    try {
      const refreshToken = await storage.getRefreshToken();
      await api.post("/v1/auth/logout", { refreshToken });
    } catch (e) {
      console.warn("Logout API error:", e);
    } finally {
      await storage.clearAll();
    }
  },

  getProfile: async (): Promise<User> => {
    const res = await api.get("/v1/users/profile");
    const user = res.data?.data || res.data;
    if (user) await storage.setUser(user);
    return user;
  },
};
