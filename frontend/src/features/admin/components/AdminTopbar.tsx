import { useEffect, useRef, useState } from "react";
import {
  useLocation,
  useNavigate,
  useSearchParams,
  Link,
} from "react-router-dom";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { useAlerts } from "@/hooks/hooks";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SoundToggle } from "@/components/ui/sound-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SlidersHorizontal,
  HelpCircle,
  LogOut,
  Search,
  Calendar,
  Bell,
  ChevronRight,
  UserCheck,
} from "lucide-react";

const ROUTE_BREADCRUMBS: Record<string, string> = {
  "/admin/dashboard": "Tổng quan Giám sát",
  "/admin/reports": "Quản lý báo cáo",
  "/admin/map": "Trung tâm điều hành",
  "/admin/gis": "Trung tâm điều hành",
  "/admin/dispatch": "Điều phối & Ca trực",
  "/admin/service-areas": "Khu vực phục vụ",
  "/admin/ai-vision": "Kiểm định AI Vision",
  "/admin/users": "Thành viên & Phân quyền",
  "/admin/settings": "Cài đặt hệ thống",
  "/admin/help": "Trợ giúp & Tài liệu",
};

export default function AdminTopbar() {
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const queryValue = searchParams.get("q") ?? "";
  const [searchText, setSearchText] = useState(queryValue);

  const { data: pendingAlerts } = useAlerts(1, 20, {
    status: "pending,ai_analyzing",
  });
  const pendingCount =
    pendingAlerts?.total ?? pendingAlerts?.items?.length ?? 0;

  useEffect(() => {
    setSearchText(searchParams.get("q") ?? "");
  }, [searchParams]);

  // Hỗ trợ phím tắt ⌘K / Ctrl+K để focus vào ô tìm kiếm nhanh
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchText(value);
    const next = new URLSearchParams(searchParams);
    if (value.trim()) {
      next.set("q", value);
    } else {
      next.delete("q");
    }
    setSearchParams(next, { replace: true });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isMapRoute =
      location.pathname.startsWith("/admin/map") ||
      location.pathname.startsWith("/admin/gis");
    if (!isMapRoute && searchText.trim()) {
      navigate(`/admin/map?q=${encodeURIComponent(searchText.trim())}`);
    }
  };

  const currentBreadcrumb =
    ROUTE_BREADCRUMBS[location.pathname] ?? "Trung tâm điều hành";
  const todayFormatted = format(new Date(), "dd/MM/yyyy");

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="relative z-20 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200/90 bg-white/95 px-5 backdrop-blur dark:border-slate-800/90 dark:bg-slate-950/95">
      {/* Trái: Breadcrumb EcoAlert > Trung tâm điều hành */}
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <Link
          to="/admin/dashboard"
          className="font-semibold text-[#047857] hover:underline dark:text-emerald-400"
        >
          EcoAlert
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="truncate font-semibold text-slate-800 dark:text-slate-100">
          {currentBreadcrumb}
        </span>
      </div>

      {/* Giữa: Ô tìm kiếm mã báo cáo, địa chỉ... kèm phím tắt ⌘K */}
      <form
        onSubmit={handleSearchSubmit}
        className="hidden max-w-md flex-1 md:block"
      >
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
          <input
            ref={searchInputRef}
            type="search"
            value={searchText}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Tìm kiếm mã báo cáo, địa chỉ..."
            aria-label="Tìm kiếm mã báo cáo, địa chỉ"
            className="h-9 w-full rounded-full border border-slate-200 bg-slate-100/80 pl-9 pr-14 text-xs text-slate-800 placeholder:text-slate-400 transition focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
          />
          <kbd className="pointer-events-none absolute right-2.5 inline-flex h-5 items-center rounded border border-slate-200 bg-white px-1.5 font-mono text-[10px] font-medium text-slate-400 shadow-2xs dark:border-slate-700 dark:bg-slate-800">
            ⌘K
          </kbd>
        </div>
      </form>

      {/* Phải: Trạng thái Live Sync, Ngày hiện tại, Chuông thông báo & Hồ sơ Admin */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Pill Trực tuyến (Live Sync) */}
        <div
          className={`hidden items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold lg:inline-flex ${
            isConnected
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          }`}
          title={
            isConnected
              ? "Kết nối WebSocket thời gian thực đang hoạt động"
              : "Đang đồng bộ qua REST API"
          }
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
            }`}
          />
          <span>
            {isConnected ? "Trực tuyến (Live Sync)" : "Đồng bộ tiêu chuẩn"}
          </span>
        </div>

        {/* Thẻ ngày tháng hiện tại */}
        <div className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 xl:inline-flex dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span>Hôm nay: {todayFormatted}</span>
        </div>

        <SoundToggle />
        <ThemeToggle />

        {/* Chuông thông báo sự cố mới */}
        <Link
          to="/admin/reports"
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-slate-50 text-slate-600 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          title={`${pendingCount} báo cáo đang chờ tiếp nhận`}
          aria-label="Thông báo báo cáo mới"
        >
          <Bell className="h-4 w-4" />
          {pendingCount > 0 && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-950" />
          )}
        </Link>

        {/* Thông tin Admin đang đăng nhập */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-full border border-slate-200/80 bg-slate-50/70 py-1 pl-3 pr-1.5 text-left transition hover:bg-slate-100 focus:outline-none dark:border-slate-800 dark:bg-slate-900">
            <div className="hidden text-right sm:block">
              <p className="max-w-[140px] truncate text-xs font-bold leading-tight text-slate-800 dark:text-slate-100">
                {user?.fullName || "Quản trị viên"}
              </p>
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                Điều phối viên Q.1
              </p>
            </div>
            <Avatar className="h-8 w-8 border border-emerald-600/30 bg-[#047857] text-white">
              <AvatarImage src={user?.avatar} />
              <AvatarFallback className="bg-[#047857] text-xs font-bold text-white">
                {user?.fullName?.charAt(0) || (
                  <UserCheck className="h-4 w-4" />
                )}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-semibold leading-none">
                  {user?.fullName}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link to="/admin/settings" className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                <span>Cài đặt hệ thống</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link to="/admin/help" className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                <span>Trợ giúp & Tài liệu</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-red-600 focus:text-red-600 cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Đăng xuất</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
