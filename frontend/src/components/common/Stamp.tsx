"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Check, FileX2, Loader2 } from "lucide-react";
import type { ReceiptStatus } from "@/types/api";
import { cn } from "@/lib/utils";

const STYLE: Record<ReceiptStatus, string> = {
  ready: "border-positive/60 text-positive",
  needs_review: "border-warning/70 text-warning bg-warning-soft",
  processing: "border-border text-muted-foreground",
  failed: "border-destructive/60 text-destructive",
};

const ICON = {
  ready: Check,
  needs_review: AlertTriangle,
  processing: Loader2,
  failed: FileX2,
} as const;

/**
 * Rubber-stamp status (icon + text, never color alone). When the status changes from
 * `processing` it "thunks" down once; that moment is the real result arriving.
 */
export function Stamp({
  status,
  className,
  size = "md",
  animateIn = false,
}: {
  status: ReceiptStatus;
  className?: string;
  size?: "sm" | "md";
  /** Play the stamp animation when it first appears. */
  animateIn?: boolean;
}) {
  const t = useTranslations("status");
  const [prevStatus, setPrevStatus] = useState(status);
  const [landed, setLanded] = useState(animateIn);
  if (status !== prevStatus) {
    setPrevStatus(status);
    if (prevStatus === "processing") setLanded(true);
  }

  const Icon = ICON[status];
  return (
    <span
      onAnimationEnd={() => setLanded(false)}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border-[1.5px] font-mono font-semibold uppercase tracking-wider",
        size === "sm" ? "h-6 px-1.5 text-[10px]" : "h-7 px-2 text-[11px]",
        status !== "processing" && "-rotate-3",
        landed && "animate-stamp",
        STYLE[status],
        className,
      )}
    >
      <Icon className={cn("size-3.5", status === "processing" && "animate-spin")} aria-hidden />
      {t(`label.${status}`)}
    </span>
  );
}
