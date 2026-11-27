import axios, { InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL } from "../utils/constants";
import { storage } from "../utils/storage";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  // Avoid holding the Expo Go UI on an unreachable development LAN address.
  timeout: 30000,
});

// Request Interceptor: Attach JWT Token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await storage.getToken();
    if (token && config.headers && !config.headers.Authorization) {
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

const REFRESH_GRACE_MS = 30_000;
let lastRefreshedFromToken: string | null = null;
let lastRefreshedToToken: string | null = null;
let lastRefreshedAt = 0;

const resetRefreshedTokenRecord = () => {
  lastRefreshedFromToken = null;
  lastRefreshedToToken = null;
  lastRefreshedAt = 0;
};

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
      originalRequest?.url?.includes("/v1/auth/refresh-token") ||
      originalRequest?.url?.includes("/v1/auth/logout");

    // Authentication endpoints handle their own errors, never global logout.
    if (
      error.response?.status === 401 && originalRequest &&
      !originalRequest._retry && !isAuthRoute
    ) {
      const sessionToken = await storage.getToken();
      if (!sessionToken) {
        resetRefreshedTokenRecord();
        return Promise.reject(error);
      }

      const requestAuth = originalRequest.headers?.Authorization;
      if (requestAuth !== `Bearer ${sessionToken}`) {
        // Retry concurrent requests that left right before another request completed refresh in the same session.
        const withinGraceWindow =
          Boolean(lastRefreshedFromToken) &&
          lastRefreshedToToken === sessionToken &&
          Date.now() - lastRefreshedAt <= REFRESH_GRACE_MS &&
          requestAuth === `Bearer ${lastRefreshedFromToken}`;
        if (withinGraceWindow) {
          originalRequest._retry = true;
          originalRequest.headers.Authorization = `Bearer ${sessionToken}`;
          return api(originalRequest);
        }
        return Promise.reject(error);
      }

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
        }, { timeout: 30_000 });

        const { accessToken: newToken, refreshToken: newRefreshToken } = res.data?.data || {};

        if (!newToken) {
          throw new Error("Failed to receive new access token");
        }

        if (sessionToken !== (await storage.getToken()))
          throw new Error("Session changed while refreshing token");

        await storage.setToken(newToken);
        if (newRefreshToken) {
          await storage.setRefreshToken(newRefreshToken);
        }

        lastRefreshedFromToken = sessionToken;
        lastRefreshedToToken = newToken;
        lastRefreshedAt = Date.now();

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);

        return api(originalRequest);
      } catch (err) {
        resetRefreshedTokenRecord();
        processQueue(err, null);
        if (sessionToken === (await storage.getToken())) {
          await storage.clearAll();
          if (onUnauthorizedCallback) onUnauthorizedCallback();
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
