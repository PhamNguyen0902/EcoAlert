import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "ecoalert_access_token";
const REFRESH_TOKEN_KEY = "ecoalert_refresh_token";
const USER_KEY = "ecoalert_user";

// Safe SecureStore wrapper that falls back to in-memory/web storage if SecureStore is not available
const isSecureStoreAvailable = Platform.OS !== "web";

export const storage = {
  getToken: async (): Promise<string | null> => {
    try {
      if (isSecureStoreAvailable) {
        return await SecureStore.getItemAsync(TOKEN_KEY);
      }
      return localStorage.getItem(TOKEN_KEY);
    } catch (e) {
      console.warn("Failed to get token from storage:", e);
      return null;
    }
  },

  setToken: async (token: string): Promise<void> => {
    try {
      if (isSecureStoreAvailable) {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
      } else {
        localStorage.setItem(TOKEN_KEY, token);
      }
    } catch (e) {
      console.warn("Failed to save token to storage:", e);
    }
  },

  removeToken: async (): Promise<void> => {
    try {
      if (isSecureStoreAvailable) {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch (e) {
      console.warn("Failed to remove token from storage:", e);
    }
  },

  getRefreshToken: async (): Promise<string | null> => {
    try {
      if (isSecureStoreAvailable) {
        return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      }
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch (e) {
      console.warn("Failed to get refresh token:", e);
      return null;
    }
  },

  setRefreshToken: async (token: string): Promise<void> => {
    try {
      if (isSecureStoreAvailable) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
      } else {
        localStorage.setItem(REFRESH_TOKEN_KEY, token);
      }
    } catch (e) {
      console.warn("Failed to save refresh token:", e);
    }
  },

  removeRefreshToken: async (): Promise<void> => {
    try {
      if (isSecureStoreAvailable) {
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      } else {
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      }
    } catch (e) {
      console.warn("Failed to remove refresh token:", e);
    }
  },

  getUser: async (): Promise<any | null> => {
    try {
      let data: string | null = null;
      if (isSecureStoreAvailable) {
        data = await SecureStore.getItemAsync(USER_KEY);
      } else {
        data = localStorage.getItem(USER_KEY);
      }
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.warn("Failed to get user from storage:", e);
      return null;
    }
  },

  setUser: async (user: any): Promise<void> => {
    try {
      const data = JSON.stringify(user);
      if (isSecureStoreAvailable) {
        await SecureStore.setItemAsync(USER_KEY, data);
      } else {
        localStorage.setItem(USER_KEY, data);
      }
    } catch (e) {
      console.warn("Failed to save user to storage:", e);
    }
  },

  removeUser: async (): Promise<void> => {
    try {
      if (isSecureStoreAvailable) {
        await SecureStore.deleteItemAsync(USER_KEY);
      } else {
        localStorage.removeItem(USER_KEY);
      }
    } catch (e) {
      console.warn("Failed to remove user from storage:", e);
    }
  },

  clearAll: async (): Promise<void> => {
    await Promise.all([
      storage.removeToken(),
      storage.removeRefreshToken(),
      storage.removeUser(),
    ]);
  },
};
