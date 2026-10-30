"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import type { DashboardResponse } from "@/types/api";
import { CountUp } from "@/components/common/Money";
import { useFormat } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Tiny trend line of the last months (real totals), drawn in plain SVG. */
function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const locale = useLocale();
  const path = useMemo(() => {
    if (values.length < 2) return null;
    const max = Math.max(...values, 1);
    const w = 200;
    const h = 56;
    const pts = values.map((v, i) => [
      (i / (values.length - 1)) * w,
      h - 4 - (v / max) * (h - 12),
    ]);
    const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    return { line, area: `${line} L${w} ${h} L0 ${h} Z`, last: pts[pts.length - 1] };
  }, [values]);
  if (!path) return null;
  return (
    <svg
      viewBox="0 0 200 56"
      preserveAspectRatio="none"
      className={cn("h-14 w-full overflow-visible", locale === "ar" && "-scale-x-100", className)}
      aria-hidden
    >
      <path d={path.area} fill="var(--color-lime)" opacity={0.12} />
      <path d={path.line} fill="none" stroke="var(--color-lime)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={path.last[0]} cy={path.last[1]} r={4} fill="var(--color-lime)" />
    </svg>
  );
}

/** The ink "this month" card: the one number people open the app for. */
export function MonthHero({
  data,
  onCurrency,
}: {
  data: DashboardResponse;
  onCurrency: (c: string) => void;
}) {
  const t = useTranslations("dashboard.hero");
  const f = useFormat();
  const monthName = f.month(format(new Date(), "yyyy-MM"), true);

  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden rounded-3xl bg-ink p-6 text-bone shadow-lift sm:p-8 dark:bg-ink-2 dark:ring-1 dark:ring-inset dark:ring-white/10"
    >
      {/* receipt perforation along the top */}
      <div aria-hidden className="absolute inset-x-6 top-0 h-px border-t-2 border-dashed border-white/10" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p id="hero-title" className="font-mono text-[11px] uppercase tracking-[0.2em] text-bone/55">
            {t("eyebrow", { month: monthName })}
          </p>
          <p className="mt-1 text-sm text-bone/70">{t("label")}</p>
        </div>
        {data.currencies.length > 1 && (
          <div role="radiogroup" aria-label={t("currency")} className="flex flex-wrap gap-1 rounded-full bg-white/5 p-1">
            {data.currencies.map((c) => {
              const active = c.currency === data.currency;
              return (
                <button
                  key={c.currency}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onCurrency(c.currency)}
                  className={cn(
                    "h-8 cursor-pointer rounded-full px-3 font-mono text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-lime",
                    active ? "bg-lime text-ink" : "text-bone/70 hover:text-bone",
                  )}
                >
                  {c.currency}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6 sm:mt-8">
        <CountUp
          value={data.this_month}
          currency={data.currency}
          className="font-heading text-5xl font-semibold tracking-tight sm:text-6xl"
          codeClassName="text-bone/60"
        />
        {data.this_month === 0 && (
          <p className="mt-2 text-sm text-bone/60">{t("nothingThisMonth")}</p>
        )}
      </div>

      <div className="mt-6 grid grid-cols-[1fr_auto] items-end gap-6">
        <Sparkline values={data.by_month.map((m) => m.total)} />
        <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-1 text-end text-sm">
          <dt className="text-bone/55">{t("allTime")}</dt>
          <dt className="text-bone/55">{t("receipts")}</dt>
          <dd className="num font-medium">{f.compact(data.total)}</dd>
          <dd className="num font-medium">{f.integer(data.receipts)}</dd>
        </dl>
      </div>
    </section>
  );
}
