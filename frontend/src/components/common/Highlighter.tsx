"use client";

import { useRef } from "react";
import { useInView } from "framer-motion";
import { cn } from "@/lib/utils";

/** Lime marker stroke behind a word that draws in when it scrolls into view. */
export function Highlighter({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  return (
    <span ref={ref} data-in={inView} className={cn("highlight", className)}>
      {children}
    </span>
  );
}
