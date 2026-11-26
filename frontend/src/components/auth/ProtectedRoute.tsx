// components/auth/ProtectedRoute.tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/types";
import { getRoleHome } from "@/lib/routes";

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

export const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const { isAuthenticated, role } = useAuth();

  // 1. Nếu chưa đăng nhập -> Đẩy ngay về /login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 2. Nếu role không hợp lệ hoặc bị thiếu -> Chặn truy cập
  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return <Navigate to={role ? getRoleHome(role) : "/login"} replace />;
  }

  // 3. Đã đăng nhập và đúng role -> Render trang bình thường
  return <Outlet />;
};
