import axios, { InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL } from "../utils/constants";
import { storage } from "../utils/storage";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// Request Interceptor: Attach JWT Token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await storage.getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Queue mechanism for handling simultaneous 401 errors during token refresh
let isRefreshing = false;
let refreshQueue: {
  resolve: (token: string) => void;
  reject: (err: any) => void;
}[] = [];

const processQueue = (error: any, token: string | null = null) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else if (token) resolve(token);
  });
  refreshQueue = [];
};

// Event listener callback for unauthorized logout in React Native
type LogoutHandler = () => void;
let onUnauthorizedCallback: LogoutHandler | null = null;

export const setUnauthorizedCallback = (callback: LogoutHandler) => {
  onUnauthorizedCallback = callback;
};

// Response Interceptor: Handle 401 & Automatic Refresh Token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthRoute =
      originalRequest?.url?.includes("/v1/auth/login") ||
      originalRequest?.url?.includes("/v1/auth/register") ||
      originalRequest?.url?.includes("/v1/auth/refresh-token");

    // Do NOT attempt refresh token logic if 401 comes from login/register requests
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await storage.getRefreshToken();
        if (!refreshToken) {
          throw new Error("No refresh token found");
        }

        // Call refresh endpoint directly with clean axios instance to avoid interceptor loop
        const res = await axios.post(`${API_BASE_URL}/v1/auth/refresh-token`, {
          refreshToken,
        });

        const { accessToken: newToken, refreshToken: newRefreshToken } = res.data?.data || {};

        if (!newToken) {
          throw new Error("Failed to receive new access token");
        }

        await storage.setToken(newToken);
        if (newRefreshToken) {
          await storage.setRefreshToken(newRefreshToken);
        }

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);

        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        await storage.clearAll();
        if (onUnauthorizedCallback) {
          onUnauthorizedCallback();
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
