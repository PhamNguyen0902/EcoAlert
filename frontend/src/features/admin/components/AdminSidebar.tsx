import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  FileText,
  Tag,
  Activity,
  BarChart3,
  ScrollText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Leaf,
  Bot,
  Map,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAlerts } from '@/hooks/hooks';

const NAV_ITEMS = [
  { to: '/admin/dashboard', key: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/admin/users', key: 'nav.users', icon: Users },
  { to: '/admin/officers', key: 'nav.officers', icon: ShieldCheck },
  { to: '/admin/reports', key: 'nav.reports', icon: FileText, showBadge: true },
  { to: '/admin/categories', key: 'nav.categories', icon: Tag },
  { to: '/admin/monitoring', key: 'nav.monitoring', icon: Activity },
  { to: '/admin/analytics', key: 'nav.analytics', icon: BarChart3 },
  { to: '/admin/incident-density', key: 'incident-density', label: 'Incident Density', icon: Map },
  { to: '/admin/audit', key: 'nav.audit', icon: ScrollText },
  { to: '/admin/settings', key: 'nav.settings', icon: Settings },
  { to: '/assistant', key: 'assistant', label: 'AI Assistant', icon: Bot },
];

export default function AdminSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { t } = useLanguage();
  const { data: pendingData } = useAlerts(1, 100, { status: 'pending,ai_analyzing' });
  const pendingCount = pendingData?.total ?? pendingData?.items?.length ?? 0;

  return (
    <div
      className={cn(
        "flex flex-col bg-card text-foreground border-r border-border dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 transition-all duration-300",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      <div className="flex h-16 items-center justify-center border-b border-border dark:border-slate-800 px-4">
        <Leaf className="h-8 w-8 text-green-500 shrink-0" />
        {!isCollapsed && <span className="ml-3 text-lg font-bold text-foreground dark:text-white whitespace-nowrap">EcoAlert Admin</span>}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={isCollapsed ? (item.label || t(item.key)) : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors relative group",
                isActive
                  ? "bg-primary text-primary-foreground dark:bg-white/10 dark:text-white"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-white/5 dark:hover:text-white",
                isCollapsed && "justify-center"
              )
            }
          >
            <item.icon className={cn("h-5 w-5 shrink-0", isCollapsed ? "mr-0" : "mr-3")} />
            {!isCollapsed && <span className="whitespace-nowrap">{item.label || t(item.key)}</span>}
            {item.showBadge && pendingCount > 0 && (
              <span
                className={cn(
                  "flex items-center justify-center bg-destructive text-destructive-foreground text-xs font-bold rounded-full px-1.5 py-0.5",
                  isCollapsed ? "absolute top-1 right-1 h-4 min-w-[16px]" : "ml-auto"
                )}
              >
                {pendingCount > 99 ? "99+" : pendingCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border dark:border-slate-800 p-3">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex w-full items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-white/5 dark:hover:text-white"
        >
          {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
