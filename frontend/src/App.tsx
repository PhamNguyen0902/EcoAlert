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
const CitizenNotifications = lazy(() => import("./pages/Notifications"));
const CitizenProfile = lazy(() => import("./pages/Profile"));

const OfficerLayout = lazy(
  () => import("./features/officer/components/OfficerLayout"),
);
const OfficerDashboard = lazy(
  () => import("./features/officer/pages/OfficerDashboard"),
);
const AssignedReports = lazy(
  () => import("./features/officer/pages/AssignedReports"),
);
const PendingVerification = lazy(
  () => import("./features/officer/pages/PendingVerification"),
);
const OfficerMap = lazy(() => import("./features/officer/pages/OfficerMap"));
const OfficerReportDetail = lazy(
  () => import("./features/officer/pages/OfficerReportDetail"),
);
const OfficerNotifications = lazy(
  () => import("./features/officer/pages/OfficerNotifications"),
);
const OfficerStats = lazy(
  () => import("./features/officer/pages/OfficerStats"),
);
// const DeletedReports = lazy(() => import('./features/officer/pages/DeletedReports'));

const AdminLayout = lazy(
  () => import("./features/admin/components/AdminLayout"),
);
const AdminDashboard = lazy(
  () => import("./features/admin/pages/AdminDashboard"),
);
const UserManagement = lazy(
  () => import("./features/admin/pages/UserManagement"),
);
const OfficerManagement = lazy(
  () => import("./features/admin/pages/OfficerManagement"),
);
const ReportManagement = lazy(
  () => import("./features/admin/pages/ReportManagement"),
);
const CategoryManagement = lazy(
  () => import("./features/admin/pages/CategoryManagement"),
);
const SystemMonitoring = lazy(
  () => import("./features/admin/pages/SystemMonitoring"),
);
const Analytics = lazy(() => import("./features/admin/pages/Analytics"));
const AuditLogs = lazy(() => import("./features/admin/pages/AuditLogs"));
const AdminSettings = lazy(
  () => import("./features/admin/pages/AdminSettings"),
);

const ProtectedRoute = lazy(() =>
  import("./components/auth/ProtectedRoute").then((m) => ({
    default: m.ProtectedRoute,
  })),
);

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <LoadingSpinner size="lg" label="Loading..." />
    </div>
  );
}

function LandingPage() {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={getRoleHome(role)} replace />;
}

function RoleRedirect() {
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
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Citizen Routes */}
          <Route element={<ProtectedRoute allowedRoles={["CITIZEN"]} />}>
            <Route element={<CitizenLayout />}>
              <Route path="/home" element={<CitizenHome />} />
              <Route path="/report" element={<CreateReport />} />
              <Route path="/my-reports" element={<MyReports />} />
              <Route path="/incidents/:id" element={<CitizenAlertDetail />} />
              <Route path="/notifications" element={<CitizenNotifications />} />
              <Route path="/profile" element={<CitizenProfile />} />
            </Route>
          </Route>

          {/* Officer Routes */}
          <Route element={<ProtectedRoute allowedRoles={["OFFICER"]} />}>
            <Route element={<OfficerLayout />}>
              <Route path="/officer/dashboard" element={<OfficerDashboard />} />
              <Route path="/officer/assigned" element={<AssignedReports />} />
              <Route path="/officer/pending" element={<PendingVerification />} />
              {/* <Route path="/officer/deleted" element={<DeletedReports />} /> */}
              <Route path="/officer/map" element={<OfficerMap />} />
              <Route
                path="/officer/reports/:id"
                element={<OfficerReportDetail />}
              />
              <Route
                path="/officer/notifications"
                element={<OfficerNotifications />}
              />
              <Route path="/officer/stats" element={<OfficerStats />} />
              <Route path="/officer/profile" element={<CitizenProfile />} />
            </Route>
          </Route>

          {/* Admin Routes */}
          <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<UserManagement />} />
              <Route path="/admin/officers" element={<OfficerManagement />} />
              <Route path="/admin/reports" element={<ReportManagement />} />
              <Route path="/admin/categories" element={<CategoryManagement />} />
              <Route
                path="/admin/reports/:id"
                element={<OfficerReportDetail />}
              />
              <Route path="/admin/monitoring" element={<SystemMonitoring />} />
              <Route path="/admin/analytics" element={<Analytics />} />
              <Route path="/admin/audit" element={<AuditLogs />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
              <Route path="/admin/profile" element={<CitizenProfile />} />
            </Route>
          </Route>

          {/* Legacy redirects */}
          <Route path="/dashboard" element={<RoleRedirect />} />
          <Route path="/reports" element={<RoleRedirect />} />
          <Route path="/map" element={<RoleRedirect />} />
          <Route path="/alerts/:id" element={<RoleRedirect />} />
          <Route path="/settings" element={<RoleRedirect />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <FloatingLanguageToggle />
    </>
  );
}

export default App;
