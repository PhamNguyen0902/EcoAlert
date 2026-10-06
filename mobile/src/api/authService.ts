import { api } from "./client";
import { LoginCredentials, RegisterData, User } from "../types";
import { storage } from "../utils/storage";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

export const authService = {
  login: async (credentials: LoginCredentials) => {
    const res = await api.post("/v1/auth/login", credentials);
    const { accessToken, refreshToken, user } = res.data?.data || res.data;
    if (!accessToken || !user?._id)
      throw new Error("Phản hồi đăng nhập không hợp lệ. Vui lòng thử lại.");
    if (accessToken) await storage.setToken(accessToken);
    if (refreshToken) await storage.setRefreshToken(refreshToken);
    if (user) await storage.setUser(user);
    return { accessToken, refreshToken, user };
  },

  register: async (data: RegisterData) => {
    const res = await api.post("/v1/auth/register", data);
    const { accessToken, refreshToken, user } = res.data?.data || res.data;
    if (!accessToken || !user?._id)
      throw new Error("Phản hồi đăng ký không hợp lệ. Vui lòng thử lại.");
    if (accessToken) await storage.setToken(accessToken);
    if (refreshToken) await storage.setRefreshToken(refreshToken);
    if (user) await storage.setUser(user);
    return { accessToken, refreshToken, user };
  },

  logout: async () => {
    const [accessToken, refreshToken] = await Promise.all([
      storage.getToken(),
      storage.getRefreshToken(),
    ]);
    // Local logout must never wait for a development gateway that may be
    // unavailable from Expo Go. Server-side token invalidation is best effort.
    await storage.clearAll();
    if (accessToken) {
      // Use the outgoing session explicitly, without the shared refresh/logout
      // interceptors. A late logout response must never clear a new login.
      void axios
        .post(`${API_BASE_URL}/v1/auth/logout`, { refreshToken }, {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 5_000,
        })
        .catch(() => undefined);
    }
  },

  getProfile: async (): Promise<User> => {
    const sessionToken = await storage.getToken();
    if (!sessionToken) throw new Error("No active session");
    const res = await api.get("/v1/users/profile", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    const user = res.data?.data || res.data;
    if (sessionToken !== (await storage.getToken()))
      throw new Error("Session changed while loading profile");
    if (user) await storage.setUser(user);
    return user;
  },
};
