import { useState } from "react";
import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ClipboardList,
  Map as MapIcon,
  ChevronLeft,
  ChevronRight,
  Leaf,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { useLanguage } from "@/contexts/LanguageContext";

export default function OfficerSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useLanguage();

  const navItems = [
    {
      name: t("officer.assigned"),
      path: "/officer/assigned",
      icon: ClipboardList,
    },
    { name: t("officer.map"), path: "/officer/map", icon: MapIcon },
  ];

  return (
    <>
      <nav
        aria-label={t("officer.navigation")}
        className="fixed inset-x-0 bottom-0 z-[1000] flex h-16 overflow-x-auto border-t border-border bg-card/95 px-1 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur md:hidden"
      >
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            title={item.name}
            aria-label={item.name}
            className={({ isActive }) =>
              cn(
                "relative flex min-w-16 flex-1 items-center justify-center rounded-lg text-muted-foreground transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted hover:text-foreground",
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="sr-only">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <motion.div
        initial={false}
        animate={{ width: collapsed ? 80 : 256 }}
        className="hidden h-full bg-card border-r border-border flex-col justify-between transition-all duration-300 md:flex"
      >
        <div>
          <div className="h-16 flex items-center justify-center border-b border-border px-4">
            <Leaf className="text-primary w-8 h-8 shrink-0" />
            {!collapsed && (
              <span className="ml-3 font-bold text-xl text-primary whitespace-nowrap">
                EcoAlert
              </span>
            )}
          </div>
          <nav className="p-4 space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    "flex items-center px-3 py-2 rounded-lg transition-colors group relative",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
                title={collapsed ? item.name : undefined}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {!collapsed && (
                  <span className="ml-3 flex-1 whitespace-nowrap">
                    {item.name}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-border">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </div>
      </motion.div>
    </>
  );
}
