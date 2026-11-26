import React, { createContext, useContext, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { User, UserRole } from "@/types";
import { authService } from "@/services/services";
import toast from "react-hot-toast";

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  login: (data: { token: string; refreshToken: string; user: User }) => void;
  logout: () => void;
}

// tạo ngữ cảnh xác thực để quản lý trạng thái người dùng và thông tin xác thực trong toàn bộ ứng dụng. 

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const queryClient = useQueryClient();
  const [authState, setAuthState] = useState<AuthState>(() => {
    const storedUser = localStorage.getItem("user");
    const storedToken = localStorage.getItem("token");
    const storedRefreshToken = localStorage.getItem("refreshToken");

    let user: User | null = null;
    try {
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed && typeof parsed === "object" && typeof parsed.role === "string") {
          user = parsed;
        }
      }
    } catch {
      user = null;
    }

    if (!storedToken || !user) {
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      return { user: null, token: null, refreshToken: null };
    }

    return {
      user,
      token: storedToken,
      refreshToken: storedRefreshToken || null,
    };
  });

  useEffect(() => {
    const handleUnauthorized = () => {
      queryClient.clear();
      setAuthState({ token: null, refreshToken: null, user: null });
    };
    const handleTokenRefreshed = (event: Event) => {
      const detail = (event as CustomEvent<{ token?: string; refreshToken?: string }>).detail;
      if (!detail?.token) return;
      setAuthState((prev) => ({
        ...prev,
        token: detail.token || prev.token,
        refreshToken: detail.refreshToken || prev.refreshToken,
      }));
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    window.addEventListener("auth:token-refreshed", handleTokenRefreshed);
    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
      window.removeEventListener("auth:token-refreshed", handleTokenRefreshed);
    };
  }, [queryClient]);

  const login = (data: { token: string; refreshToken: string; user: User }) => {
    localStorage.setItem("token", data.token);
    localStorage.setItem("refreshToken", data.refreshToken);
    localStorage.setItem("user", JSON.stringify(data.user));

    setAuthState({
      token: data.token,
      refreshToken: data.refreshToken,
      user: data.user,
    });
  };

  const logout = () => {
    const currentAccessToken = authState.token || localStorage.getItem("token") || undefined;
    const currentRefreshToken = authState.refreshToken || localStorage.getItem("refreshToken") || undefined;
    if (currentAccessToken) {
      void authService.logout(currentRefreshToken, currentAccessToken).catch(() => undefined);
    }

    toast.dismiss();
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    queryClient.clear();

    setAuthState({
      token: null,
      refreshToken: null,
      user: null,
    });
  };

  const contextValue: AuthContextType = {
    user: authState.user,
    token: authState.token,
    role: authState.user?.role
      ? (authState.user.role.toUpperCase() as UserRole)
      : null,
    isAuthenticated: Boolean(authState.token && authState.user),
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
