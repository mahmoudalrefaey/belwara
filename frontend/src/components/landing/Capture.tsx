"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { Camera, Check, ScanLine, ShieldCheck } from "lucide-react";
import { Wara } from "@/components/illustrations/Wara";
import { cn } from "@/lib/utils";
import { DemoTag } from "@/components/landing/DemoTag";

type DemoItem = { name: string; total: string };

/** A paper receipt used in the demos. */
export function DemoReceipt({ className, compact = false }: { className?: string; compact?: boolean }) {
  const t = useTranslations("landing.demo");
  const items = t.raw("items") as DemoItem[];
  return (
    <div className={cn("drop-shadow-[0_12px_18px_rgb(10_10_11/0.25)]", className)}>
      <div className="edge-torn rounded-t-xl bg-paper px-4 pb-7 pt-4 text-ink [--tooth:10px]">
        <p className="text-center font-heading text-sm font-bold">{t("merchant")}</p>
        <p className="text-center font-mono text-[10px] text-ink/55">{t("date")}</p>
        <div className="my-2.5 border-t-2 border-dashed border-ink/20" />
        <ul className={cn("space-y-1.5 text-[11px]", compact && "space-y-1")}>
          {items.map((it) => (
            <li key={it.name} className="flex items-end gap-1">
              <span className="truncate">{it.name}</span>
              <span className="leader" aria-hidden />
              <span className="num">{it.total}</span>
            </li>
          ))}
        </ul>
        <div className="my-2.5 border-t-2 border-dashed border-ink/20" />
        <div className="flex items-end gap-1 text-xs font-semibold">
          <span>{t("totalLabel")}</span>
          <span className="leader" aria-hidden />
          <span className="num" dir="ltr">{t("total")}</span>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  { key: "snap", icon: Camera },
  { key: "read", icon: ScanLine },
  { key: "check", icon: ShieldCheck },
] as const;

export function Capture() {
  const t = useTranslations("landing.capture");
  const td = useTranslations("landing.demo");
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [step, setStep] = useState(0);
  const [desktop, setDesktop] = useState(true);
  const inView = useInView(phoneRef, { once: true, amount: 0.5 });

  // Desktop: the scroll scrubs the story. Phones: it plays once when the phone comes into view.
  const progress = useMotionValue(0);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (desktop) progress.set(v);
  });
  useEffect(() => {
    if (desktop || !inView) return;
    const c = animate(progress, 1, { duration: 4, ease: "linear", delay: 0.3 });
    return () => c.stop();
  }, [desktop, inView, progress]);
  useMotionValueEvent(progress, "change", (v) => {
    setStep(v < 0.33 ? 0 : v < 0.62 ? 1 : 2);
  });

  // Receipt slides under the camera → scan line sweeps → it becomes a stamped card.
  const receiptY = useTransform(progress, [0, 0.28], ["115%", "0%"]);
  const receiptOpacity = useTransform(progress, [0.6, 0.7], [1, 0]);
  const scanY = useTransform(progress, [0.33, 0.6], ["0%", "100%"]);
  const scanOpacity = useTransform(progress, [0.3, 0.34, 0.58, 0.62], [0, 1, 1, 0]);
  const cardOpacity = useTransform(progress, [0.64, 0.74], [0, 1]);
  const cardY = useTransform(progress, [0.64, 0.74], [24, 0]);
  const stampScale = useTransform(progress, [0.74, 0.8], [1.8, 1]);
  const stampOpacity = useTransform(progress, [0.74, 0.78], [0, 1]);

  const final = !!reduce;
  const active = final ? 2 : step;

  return (
    <section id="how" ref={ref} className={cn("relative bg-background", !final && "lg:h-[240vh]")} aria-labelledby="how-title">
      <div className={cn("flex items-center py-24", !final && "lg:sticky lg:top-0 lg:h-dvh lg:py-0")}>
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2">
          <div className="space-y-8">
            <div className="space-y-3">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("eyebrow")}</p>
              <h2 id="how-title" className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">
                {t("title")}
              </h2>
              <p className="max-w-md text-lg text-muted-foreground">{t("subtitle")}</p>
            </div>
            <ol className="space-y-3">
              {STEPS.map(({ key, icon: Icon }, i) => (
                <li
                  key={key}
                  className={cn(
                    "flex gap-4 rounded-2xl border p-4 transition-[background-color,border-color,opacity] duration-300",
                    i === active ? "border-foreground bg-card shadow-paper" : "border-transparent opacity-55",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-xl transition-colors",
                      i === active ? "bg-lime text-ink" : "bg-muted",
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-heading font-semibold">{t(`steps.${key}.title`)}</p>
                    <p className="text-sm text-muted-foreground">{t(`steps.${key}.body`)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Phone */}
          <div ref={phoneRef} className="relative mx-auto w-[280px] sm:w-[300px]" aria-hidden>
            <div className="rounded-[44px] bg-ink p-3 shadow-lift ring-1 ring-black/5">
              <div className="relative h-[520px] overflow-hidden rounded-[34px] bg-ink-2">
                <div className="absolute inset-x-0 top-3 mx-auto h-6 w-24 rounded-full bg-ink" />

                {/* Viewfinder */}
                <motion.div style={{ opacity: final ? 0 : receiptOpacity }} className="absolute inset-x-6 top-14 bottom-28">
                  {["start-0 top-0 border-s-4 border-t-4 rounded-ss-2xl", "end-0 top-0 border-e-4 border-t-4 rounded-se-2xl", "start-0 bottom-0 border-s-4 border-b-4 rounded-es-2xl", "end-0 bottom-0 border-e-4 border-b-4 rounded-ee-2xl"].map((c) => (
                    <span key={c} className={cn("absolute size-8 border-lime", c)} />
                  ))}
                  <div className="absolute inset-4 overflow-hidden">
                    <motion.div style={{ y: receiptY }}>
                      <DemoReceipt compact />
                    </motion.div>
                    <motion.div
                      style={{ top: scanY, opacity: scanOpacity }}
                      className="absolute inset-x-0 h-12 -translate-y-1/2 bg-gradient-to-b from-transparent via-lime/60 to-transparent"
                    />
                  </div>
                </motion.div>

                {/* Result card */}
                <motion.div
                  style={final ? undefined : { opacity: cardOpacity, y: cardY }}
                  className="absolute inset-x-4 top-16 space-y-3"
                >
                  <p className="px-1 text-xs text-bone/50">{t("phoneList")}</p>
                  <div className="edge-torn rounded-t-2xl bg-bone px-4 pb-7 pt-4 text-ink [--tooth:10px]">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-lg bg-lime text-xs font-bold">{td("merchant").slice(0, 1)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{td("merchant")}</p>
                        <p className="text-[11px] text-ink/55">{td("date")}</p>
                      </div>
                    </div>
                    <div className="my-3 border-t-2 border-dashed border-ink/15" />
                    <div className="flex items-center justify-between">
                      <span className="num text-lg font-semibold" dir="ltr">{td("total")}</span>
                      <motion.span
                        style={final ? undefined : { scale: stampScale, opacity: stampOpacity }}
                        className="inline-flex -rotate-6 items-center gap-1 rounded-md border-[1.5px] border-positive px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-positive"
                      >
                        <Check className="size-3" />
                        {t("stamp")}
                      </motion.span>
                    </div>
                  </div>
                  {[0.55, 0.35].map((o) => (
                    <div key={o} className="h-16 rounded-2xl bg-bone/10" style={{ opacity: o }} />
                  ))}
                </motion.div>

                {/* Shutter */}
                <div className="absolute inset-x-0 bottom-8 flex justify-center">
                  <span className="grid size-16 place-items-center rounded-full border-4 border-bone/30">
                    <span className="size-12 rounded-full bg-lime" />
                  </span>
                </div>
              </div>
            </div>
            <Wara pose={active === 2 ? "proud" : active === 1 ? "reading" : "hello"} className="absolute -bottom-6 -start-16 w-24 text-ink dark:text-bone sm:-start-20 sm:w-28" />
            <DemoTag className="absolute -top-3 end-0" />
          </div>
        </div>
      </div>
    </section>
  );
}
