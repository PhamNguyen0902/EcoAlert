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
  return (
    <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
      <Card className={cn("overflow-hidden p-6", className)}>
        <div className="flex items-start justify-between">
          <div className="space-y-4">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold">
                {typeof value === 'number' ? <AnimatedCounter value={value} /> : value}
              </span>
            </div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
            {trend && (
              <div className="flex items-center gap-1">
                {trend.isPositive ? (
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-rose-500" />
                )}
                <span
                  className={cn(
                    "text-sm font-medium",
                    trend.isPositive ? "text-emerald-500" : "text-rose-500"
                  )}
                >
                  {trend.value}%
                </span>
                <span className="text-xs text-muted-foreground ml-1">vs last period</span>
              </div>
            )}
          </div>
          <div className={cn("rounded-xl p-3", gradient)}>
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
