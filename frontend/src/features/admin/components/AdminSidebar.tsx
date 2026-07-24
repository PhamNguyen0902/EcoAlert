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
  Leaf
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const NAV_ITEMS = [
  { to: '/admin/dashboard', key: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/admin/users', key: 'nav.users', icon: Users },
  { to: '/admin/officers', key: 'nav.officers', icon: ShieldCheck },
  { to: '/admin/reports', key: 'nav.reports', icon: FileText },
  { to: '/admin/categories', key: 'nav.categories', icon: Tag },
  { to: '/admin/monitoring', key: 'nav.monitoring', icon: Activity },
  { to: '/admin/analytics', key: 'nav.analytics', icon: BarChart3 },
  { to: '/admin/audit', key: 'nav.audit', icon: ScrollText },
  { to: '/admin/settings', key: 'nav.settings', icon: Settings },
];

export default function AdminSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { t } = useLanguage();

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
            title={isCollapsed ? t(item.key) : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground dark:bg-white/10 dark:text-white"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-white/5 dark:hover:text-white",
                isCollapsed && "justify-center"
              )
            }
          >
            <item.icon className={cn("h-5 w-5 shrink-0", isCollapsed ? "mr-0" : "mr-3")} />
            {!isCollapsed && <span className="whitespace-nowrap">{t(item.key)}</span>}
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
