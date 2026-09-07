"use client";

import { useEffect, useRef } from "react";
import { useSpring, useMotionValue, motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
}
// Hiển thị bộ đếm số liệu với hiệu ứng hoạt hình, hỗ trợ định dạng số và thời gian hoạt hình tùy chỉnh.
export function AnimatedCounter({ value, duration = 1, className }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    duration: duration * 1000,
    bounce: 0,
  });

  useEffect(() => {
    motionValue.set(value);
  }, [motionValue, value]);

  useEffect(() => {
    return springValue.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = Intl.NumberFormat().format(Math.round(latest));
      }
    });
  }, [springValue]);

  return <motion.span ref={ref} className={cn("", className)}>{Intl.NumberFormat().format(0)}</motion.span>;
}
