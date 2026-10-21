import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Map,
  Route,
  Hexagon,
  ScanEye,
  Users,
  SlidersHorizontal,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Leaf,
  type LucideIcon,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAlerts } from "@/hooks/hooks";
import { useAdminUsers } from "@/hooks/useAdminDashboard";

interface SidebarNavItem {
  to: string;
  aliases?: string[];
  labelVi: string;
  labelEn: string;
  icon: LucideIcon;
  badgeType?: "pending_alerts" | "total_users";
}

interface SidebarNavSection {
  id: string;
  titleVi: string;
  titleEn: string;
  items: SidebarNavItem[];
}

const MAIN_NAV_SECTIONS: SidebarNavSection[] = [
  {
    id: "operations",
    titleVi: "ĐIỀU HÀNH",
    titleEn: "OPERATIONS",
    items: [
      {
        to: "/admin/dashboard",
        labelVi: "Tổng quan",
        labelEn: "Dashboard",
        icon: LayoutDashboard,
      },
      {
        to: "/admin/reports",
        labelVi: "Quản lý báo cáo",
        labelEn: "Report Management",
        icon: FileText,
        badgeType: "pending_alerts",
      },
      {
        to: "/admin/map",
        aliases: ["/admin/gis"],
        labelVi: "Bản đồ GIS",
        labelEn: "GIS Map",
        icon: Map,
      },
      {
        to: "/admin/service-areas",
        labelVi: "Khu vực phục vụ",
        labelEn: "Service Areas",
        icon: Hexagon,
      },
    ],
  },
  {
    id: "territory_ai",
    titleVi: "ĐIỀU PHỐI & AI",
    titleEn: "DISPATCH & AI",
    items: [
      {
        to: "/admin/dispatch",
        labelVi: "Điều phối & Ca trực",
        labelEn: "Dispatch & Shifts",
        icon: Route,
      },
      {
        to: "/admin/ai-vision",
        labelVi: "Kiểm định AI Vision",
        labelEn: "AI Vision Inspector",
        icon: ScanEye,
      },
    ],
  },
  {
    id: "governance",
    titleVi: "QUẢN TRỊ",
    titleEn: "GOVERNANCE",
    items: [
      {
        to: "/admin/users",
        labelVi: "Thành viên & Phân quyền",
        labelEn: "Members & Roles",
        icon: Users,
        badgeType: "total_users",
      },
    ],
  },
];

const PINNED_BOTTOM_ITEMS: SidebarNavItem[] = [
  {
    to: "/admin/settings",
    labelVi: "Cài đặt hệ thống",
    labelEn: "System Settings",
    icon: SlidersHorizontal,
  },
  {
    to: "/admin/help",
    labelVi: "Trợ giúp & Tài liệu",
    labelEn: "Help & Documentation",
    icon: HelpCircle,
  },
];

// Thanh điều hướng quản trị EcoAlert Operations HQ: 3 nhóm nghiệp vụ chính + 2 mục tiện ích ghim sát đáy
export default function AdminSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { language } = useLanguage();
  const location = useLocation();

  const { data: pendingData } = useAlerts(1, 100, {
    status: "pending,ai_analyzing",
  });
  const { data: usersData } = useAdminUsers({ page: 1, limit: 1 });

  const pendingCount = pendingData?.total ?? pendingData?.items?.length ?? 0;
  const totalUsersCount = usersData?.total ?? 0;

  const getBadgeValue = (badgeType?: SidebarNavItem["badgeType"]) => {
    if (badgeType === "pending_alerts" && pendingCount > 0) {
      return pendingCount > 99 ? "99+" : String(pendingCount);
    }
    if (badgeType === "total_users" && totalUsersCount > 0) {
      return totalUsersCount > 999 ? "999+" : String(totalUsersCount);
    }
    return null;
  };

  const renderNavItem = (item: SidebarNavItem) => {
    const label = language === "vi" ? item.labelVi : item.labelEn;
    const badgeValue = getBadgeValue(item.badgeType);
    const isAlertBadge = item.badgeType === "pending_alerts";
    const isAliasMatch =
      item.aliases?.some((alias) => location.pathname.startsWith(alias)) ??
      false;

    return (
      <NavLink
        key={item.to}
        to={item.to}
        title={isCollapsed ? label : undefined}
        className={({ isActive }) => {
          const active = isActive || isAliasMatch;
          return cn(
            "group relative flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
            active
              ? "bg-[#065F46] text-white shadow-sm dark:bg-[#047857] dark:text-white"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100",
            isCollapsed && "justify-center px-2 py-2.5",
          );
        }}
      >
        {({ isActive }) => {
          const active = isActive || isAliasMatch;
          return (
            <>
              <item.icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0 transition-colors duration-150",
                  active
                    ? "text-white"
                    : "text-slate-500 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200",
                  !isCollapsed && "mr-3",
                )}
              />
              {!isCollapsed && (
                <span className="truncate whitespace-nowrap">{label}</span>
              )}
              {badgeValue && (
                <span
                  className={cn(
                    "flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                    isAlertBadge
                      ? "bg-red-500 text-white shadow-xs"
                      : active
                        ? "bg-white/20 text-white"
                        : "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
                    isCollapsed
                      ? "absolute top-1 right-1 h-4 min-w-[16px] px-1 text-[9px]"
                      : "ml-auto",
                  )}
                >
                  {badgeValue}
                </span>
              )}
              {/* Tooltip hiển thị khi Sidebar thu gọn */}
              {isCollapsed && (
                <span
                  role="tooltip"
                  className="pointer-events-none invisible absolute left-full z-50 ml-2.5 whitespace-nowrap rounded-md border bg-popover px-2.5 py-1 text-xs font-medium text-popover-foreground opacity-0 shadow-md transition-all duration-150 group-hover:visible group-hover:opacity-100"
                >
                  {label}
                  {badgeValue ? ` (${badgeValue})` : ""}
                </span>
              )}
            </>
          );
        }}
      </NavLink>
    );
  };

  return (
    <aside
      aria-label="Thanh điều hướng Quản trị"
      className={cn(
        "flex h-full flex-col justify-between border-r border-slate-200/90 bg-white text-slate-800 transition-all duration-200 dark:border-slate-800/90 dark:bg-slate-950 dark:text-slate-200",
        isCollapsed ? "w-[72px]" : "w-60",
      )}
    >
      {/* Header thương hiệu: EcoAlert + Operations HQ + badge TP.HCM */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 px-4 dark:border-slate-800/90">
        <div
          className={cn(
            "flex items-center gap-2.5 min-w-0",
            isCollapsed && "w-full justify-center",
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#047857] text-white shadow-xs">
            <Leaf className="h-5 w-5" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[17px] font-bold leading-tight tracking-tight text-slate-900 dark:text-white">
                  EcoAlert
                </span>
              </div>
              <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Operations HQ
              </p>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            TP.HCM
          </span>
        )}
      </div>

      {/* PHẦN A: Danh sách Menu Chính ở trên */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {MAIN_NAV_SECTIONS.map((section) => (
          <div key={section.id} className="space-y-1">
            {!isCollapsed ? (
              <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                {language === "vi" ? section.titleVi : section.titleEn}
              </p>
            ) : (
              <div className="mx-auto my-1.5 h-px w-6 bg-slate-200 dark:bg-slate-800" />
            )}
            <div className="space-y-1">
              {section.items.map((item) => renderNavItem(item))}
            </div>
          </div>
        ))}
      </nav>

      {/* PHẦN B: Cụm 2 Mục Ghim Cố Định Sát Đáy + Dòng phiên bản v2.4.0 */}
      <div className="mt-auto border-t border-slate-200/80 p-3 dark:border-slate-800/90">
        <div className="space-y-1">
          {PINNED_BOTTOM_ITEMS.map((item) => renderNavItem(item))}
        </div>

        <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2.5 px-2 text-[11px] text-slate-400 dark:border-slate-800/70 dark:text-slate-500">
          {!isCollapsed && (
            <div className="flex w-full items-center justify-between pr-1">
              <span>Hệ thống EcoAlert</span>
              <span className="font-mono font-medium">v2.4.0</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
            title={isCollapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200",
              isCollapsed && "mx-auto",
            )}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
