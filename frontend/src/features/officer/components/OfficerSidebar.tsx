import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, ClipboardList, ShieldCheck, 
  Map as MapIcon, Bell, BarChart3, ChevronLeft, ChevronRight, Leaf, User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUnreadCount } from '@/hooks/hooks';

export default function OfficerSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { data: unreadCount = 0 } = useUnreadCount();

  const navItems = [
    { name: 'Dashboard', path: '/officer/dashboard', icon: LayoutDashboard },
    { name: 'Assigned Reports', path: '/officer/assigned', icon: ClipboardList },
    { name: 'Pending Verification', path: '/officer/pending', icon: ShieldCheck },
    { name: 'GIS Monitoring', path: '/officer/map', icon: MapIcon },
    { name: 'Notifications', path: '/officer/notifications', icon: Bell, badge: unreadCount },
    { name: 'Statistics', path: '/officer/stats', icon: BarChart3 },
  ];

  return (
    <motion.div 
      initial={false}
      animate={{ width: collapsed ? 80 : 256 }}
      className="h-full bg-card border-r border-border flex flex-col justify-between transition-all duration-300"
    >
      <div>
        <div className="h-16 flex items-center justify-center border-b border-border px-4">
          <Leaf className="text-primary w-8 h-8 shrink-0" />
          {!collapsed && (
            <span className="ml-3 font-bold text-xl text-primary whitespace-nowrap">EcoAlert</span>
          )}
        </div>
        <nav className="p-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                "flex items-center px-3 py-2 rounded-lg transition-colors group relative",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && (
                <span className="ml-3 flex-1 whitespace-nowrap">{item.name}</span>
              )}
              {item.badge !== undefined && item.badge > 0 && (
                <span className={cn(
                  "flex items-center justify-center bg-destructive text-destructive-foreground text-xs font-bold rounded-full",
                  collapsed ? "absolute top-0 right-0 w-4 h-4 translate-x-1 -translate-y-1" : "w-5 h-5 ml-auto"
                )}>
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="p-4 border-t border-border space-y-2">
        <NavLink
          to="/officer/profile"
          className={({ isActive }) => cn(
            "flex items-center px-3 py-2 rounded-lg transition-colors",
            isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          title={collapsed ? "Profile" : undefined}
        >
          <User className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="ml-3 whitespace-nowrap">Profile</span>}
        </NavLink>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
    </motion.div>
  );
}
