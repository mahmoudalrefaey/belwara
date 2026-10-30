"use client";

import { motion } from "framer-motion";
import { rise, stagger } from "@/lib/motion";

/** Rise into view once. Children marked with <RevealItem> stagger in. */
export function Reveal({
  children,
  className,
  step = 0.06,
  delay = 0,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  step?: number;
  delay?: number;
  as?: "div" | "section" | "ul";
}) {
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      variants={stagger(step, delay)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
    >
      {children}
    </Comp>
  );
}

export function RevealItem({
  children,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "li" | "article";
}) {
  const Comp = motion[as];
  return (
    <Comp className={className} variants={rise}>
      {children}
    </Comp>
  );
}
