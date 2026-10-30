"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { Highlighter } from "@/components/common/Highlighter";
import { FlyingSalary } from "@/components/illustrations/Scenes";
import { Wara } from "@/components/illustrations/Wara";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Loose receipts drifting at different depths: everyday spending chaos. */
const SLIPS = [
  { x: "6%", y: "18%", r: -14, w: 74, speed: -160 },
  { x: "88%", y: "14%", r: 12, w: 60, speed: -260 },
  { x: "78%", y: "72%", r: -8, w: 84, speed: -120 },
  { x: "14%", y: "78%", r: 18, w: 56, speed: -220 },
  { x: "46%", y: "6%", r: 6, w: 48, speed: -320 },
];

function Slip({ s, progress }: { s: (typeof SLIPS)[number]; progress: MotionValue<number> }) {
  const y = useTransform(progress, [0, 1], [0, s.speed]);
  return (
    <motion.div
      aria-hidden
      style={{ left: s.x, top: s.y, y, rotate: s.r, width: s.w }}
      className="pointer-events-none absolute hidden opacity-[0.18] sm:block"
    >
      <div className="edge-torn rounded-t-md bg-bone px-2 pb-4 pt-2 [--tooth:8px]">
        {[70, 50, 85, 40, 60].map((w, i) => (
          <div key={i} className="mb-1.5 h-1 rounded-full bg-ink/40" style={{ width: `${w}%` }} />
        ))}
      </div>
    </motion.div>
  );
}

/** The impossibly long receipt: unrolls further the more you scroll. */
function LongReceipt({ progress }: { progress: MotionValue<number> }) {
  const t = useTranslations("landing.hero");
  const reduce = useReducedMotion();
  const height = useTransform(progress, [0, 0.8], [210, 420]);
  const items = t.raw("longItems") as string[];
  return (
    <motion.div
      style={{ height: reduce ? 320 : height }}
      className="relative w-48 overflow-hidden drop-shadow-[0_20px_30px_rgb(0_0_0/0.45)] sm:w-56"
    >
      <div className="edge-torn absolute inset-0 rounded-t-xl bg-paper px-4 pb-8 pt-4 text-ink [--tooth:12px]">
        <p className="text-center font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/50">
          {t("longTitle")}
        </p>
        <div className="my-2 border-t-2 border-dashed border-ink/20" />
        <ul className="space-y-1.5 font-mono text-[11px]">
          {Array.from({ length: 4 }).flatMap((_, round) =>
            items.map((it, i) => (
              <li key={`${round}-${i}`} className="flex items-end gap-1">
                <span className="truncate">{it}</span>
                <span className="leader" aria-hidden />
                <span className="text-ink/60">??.??</span>
              </li>
            )),
          )}
        </ul>
      </div>
    </motion.div>
  );
}

export function Hero() {
  const t = useTranslations("landing.hero");
  const { isAuthenticated } = useAuth();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const sceneY = useTransform(scrollYProgress, [0, 1], [0, 80]);

  return (
    <section
      ref={ref}
      className="relative isolate overflow-hidden bg-ink pb-20 pt-32 text-bone sm:pb-28 sm:pt-40"
      aria-labelledby="hero-heading"
    >
      {SLIPS.map((s, i) => (
        <Slip key={i} s={s} progress={scrollYProgress} />
      ))}

      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-8">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-sm text-bone/80"
          >
            <span className="size-2 rounded-full bg-lime" aria-hidden />
            {t("eyebrow")}
          </motion.p>

          <motion.h1
            id="hero-heading"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
            className="font-heading text-5xl font-bold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl"
          >
            {t.rich("title", { mark: (c) => <Highlighter className="[--hl-fg:var(--color-ink)]">{c}</Highlighter> })}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="max-w-xl text-lg text-bone/75 sm:text-xl"
          >
            {t("subtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="flex flex-wrap items-center gap-3"
          >
            <Link
              href={isAuthenticated ? "/dashboard" : "/register"}
              className={buttonVariants({ size: "lg", className: "px-8" })}
            >
              {isAuthenticated ? t("ctaApp") : t("cta")}
            </Link>
            <a
              href="#how"
              className={cn(
                buttonVariants({ variant: "ghost", size: "lg" }),
                "text-bone hover:bg-white/10",
              )}
            >
              {t("secondary")}
              <ArrowDown className="size-4" aria-hidden />
            </a>
          </motion.div>
          <p className="text-sm text-bone/50">{t("note")}</p>
        </div>

        <motion.div style={{ y: sceneY }} className="relative mx-auto flex w-full max-w-md items-start justify-center gap-2" aria-hidden>
          <div className="absolute -top-4 end-0 w-56 text-bone sm:w-64">
            <FlyingSalary className="w-full" />
          </div>
          <div className="mt-28 flex items-start">
            <Wara pose="squint" className="mt-24 w-28 shrink-0 text-bone sm:w-32" />
            <LongReceipt progress={scrollYProgress} />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
