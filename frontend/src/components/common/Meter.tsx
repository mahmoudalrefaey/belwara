"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Usage meter: fills to the real value; turns warning near the limit and destructive at it. */
export function Meter({
  value,
  max,
  label,
  className,
  tone = "auto",
}: {
  value: number;
  max: number;
  label: string;
  className?: string;
  tone?: "auto" | "inverse";
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color =
    pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-warning" : "bg-primary";
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn(
        "h-2 overflow-hidden rounded-full",
        tone === "inverse" ? "bg-white/10" : "bg-muted",
        className,
      )}
    >
      <motion.div
        className={cn("h-full origin-left rounded-full rtl:origin-right", color)}
        style={{ width: `${pct}%` }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}
