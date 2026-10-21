import { Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import AdminSidebar from "./AdminSidebar";
import AdminTopbar from "./AdminTopbar";

// layout chung cho toàn bộ trang quản trị (admin)
export default function AdminLayout() {
  const location = useLocation();
  const isFullBleedMap =
    location.pathname.startsWith("/admin/map") ||
    location.pathname.startsWith("/admin/gis");

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminTopbar />
        <main
          className={cn(
            "relative z-0 flex-1 bg-background",
            isFullBleedMap ? "overflow-hidden p-0" : "overflow-y-auto p-6",
          )}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
