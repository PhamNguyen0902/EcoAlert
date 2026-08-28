import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { LoadingSpinner } from "./components/ui/loading-spinner";
import { useAuth } from "./contexts/AuthContext";
import { getRoleHome } from "./lib/routes";
import { FloatingLanguageToggle } from "./components/ui/language-toggle";

const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));

const CitizenLayout = lazy(
  () => import("./features/citizen/components/CitizenLayout"),
);
const CitizenHome = lazy(() => import("./features/citizen/pages/CitizenHome"));
const CreateReport = lazy(() => import("./pages/CreateAlert"));
const MyReports = lazy(() => import("./features/citizen/pages/MyReports"));
const CitizenAlertDetail = lazy(() => import("./pages/AlertDetail"));

const OfficerLayout = lazy(
  () => import("./features/officer/components/OfficerLayout"),
);
const AssignedReports = lazy(
  () => import("./features/officer/pages/AssignedReports"),
);
const OfficerMap = lazy(() => import("./features/officer/pages/OfficerMap"));
const OfficerReportDetail = lazy(
  () => import("./features/officer/pages/OfficerReportDetail"),
);

const AdminLayout = lazy(
  () => import("./features/admin/components/AdminLayout"),
);
const ReportManagement = lazy(
  () => import("./features/admin/pages/ReportManagement"),
);
const AdminGisMap = lazy(() => import("./features/admin/pages/AdminGisMap"));

const ProtectedRoute = lazy(() =>
  import("./components/auth/ProtectedRoute").then((m) => ({
    default: m.ProtectedRoute,
  })),
);

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <LoadingSpinner size="lg" label="Đang tải..." />
    </div>
  );
}

function LandingPage() {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={getRoleHome(role)} replace />;
}

function App() {
  return (
    <>
      <Routes>
        <Route
          element={
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          }
        >
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          {/* đăng nhập */}
          <Route path="/login" element={<Login />} />
          {/* đăng ký */}
          <Route path="/register" element={<Register />} />
          {/* Citizen Routes */}
          <Route element={<ProtectedRoute allowedRoles={["CITIZEN"]} />}>
            <Route element={<CitizenLayout />}>
              <Route path="/home" element={<CitizenHome />} />
              {/* tạo report */}
              <Route path="/report" element={<CreateReport />} />
              <Route path="/my-reports" element={<MyReports />} />
              <Route path="/incidents/:id" element={<CitizenAlertDetail />} />
            </Route>
          </Route>
          {/* Officer Routes */}
          <Route element={<ProtectedRoute allowedRoles={["OFFICER"]} />}>
            <Route element={<OfficerLayout />}>
            {/* task của officer */}
              <Route path="/officer/assigned" element={<AssignedReports />} />
              <Route path="/officer/map" element={<OfficerMap />} />
              <Route
                path="/officer/reports/:id"
                element={<OfficerReportDetail />}
              />
            </Route>
          </Route>
          {/* Admin Routes */}
          <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
            <Route element={<AdminLayout />}>
              {/* admin quản lý report */}
              <Route path="/admin/reports" element={<ReportManagement />} />
              <Route path="/admin/gis" element={<AdminGisMap />} />
              <Route
                path="/admin/reports/:id"
                element={<OfficerReportDetail />}
              />
            </Route>
          </Route>
          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <FloatingLanguageToggle />
    </>
  );
}

export default App;
