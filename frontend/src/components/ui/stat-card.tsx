"use client";

import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  gradient?: string;
  className?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  gradient = "bg-gradient-to-br from-primary/20 to-primary/5",
  className,
}: StatCardProps) {
  const isLongText = typeof value === 'string' && value.length > 5;

  return (
    <motion.div className="h-full" whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
      <Card className={cn("overflow-hidden p-6 h-full flex flex-col justify-between", className)}>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-2 min-w-0 flex-1">
            <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
            <div className="flex items-center gap-2">
              <span className={cn("font-bold tracking-tight leading-tight", isLongText ? "text-xl sm:text-2xl" : "text-3xl")}>
                {typeof value === 'number' ? <AnimatedCounter value={value} /> : value}
              </span>
            </div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
            {trend && (
              <div className="flex items-center gap-1">
                {trend.isPositive ? (
                  <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-rose-500 shrink-0" />
                )}
                <span
                  className={cn(
                    "text-sm font-medium",
                    trend.isPositive ? "text-emerald-500" : "text-rose-500"
                  )}
                >
                  {trend.value}%
                </span>
                <span className="text-xs text-muted-foreground ml-1 truncate">vs last period</span>
              </div>
            )}
          </div>
          <div className={cn("rounded-xl p-3 shrink-0", gradient)}>
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
