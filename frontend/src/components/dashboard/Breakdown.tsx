"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import type { LabeledTotal } from "@/types/api";
import { Link } from "@/i18n/navigation";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import { EmptyState } from "@/components/common/EmptyState";
import { Money } from "@/components/common/Money";
import { isKnownCategory } from "@/lib/receiptStatus";
import { cn } from "@/lib/utils";

const SERIES = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5", "--chart-6"];

/**
 * Ranked bars (easier to compare than a pie). Each row opens the matching receipts.
 * Rows without a filterable value ("Unknown") are shown but not linked.
 */
function RankedList({
  rows,
  currency,
  hrefFor,
  labelFor,
  iconFor,
  colored,
}: {
  rows: LabeledTotal[];
  currency: string | null;
  hrefFor: (label: string) => string | null;
  labelFor: (label: string) => string;
  iconFor?: (label: string) => React.ReactNode;
  colored?: boolean;
}) {
  const max = Math.max(...rows.map((r) => r.total), 1);
  const sum = rows.reduce((n, r) => n + r.total, 0) || 1;
  return (
    <motion.ul
      className="space-y-1"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.3 }}
    >
      {rows.map((r, i) => {
        const href = hrefFor(r.label);
        const pct = Math.round((r.total / sum) * 100);
        const body = (
          <>
            {iconFor?.(r.label)}
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate font-medium bidi" dir="auto">{labelFor(r.label)}</span>
                <Money amount={r.total} currency={currency} className="text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full origin-left rounded-full rtl:origin-right"
                    style={{
                      width: `${(r.total / max) * 100}%`,
                      background: colored ? `var(${SERIES[i % SERIES.length]})` : "var(--foreground)",
                    }}
                    variants={{
                      hidden: { scaleX: 0 },
                      show: { scaleX: 1, transition: { duration: 0.7, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] } },
                    }}
                  />
                </div>
                <span className="num w-9 text-end text-xs text-muted-foreground">{pct}%</span>
              </div>
            </div>
            {href && (
              <ChevronLeft className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 ltr:rotate-180" aria-hidden />
            )}
          </>
        );
        return (
          <li key={r.label}>
            {href ? (
              <Link href={href} className="group flex items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-muted/70">
                {body}
              </Link>
            ) : (
              <div className="flex items-center gap-3 p-2.5">{body}</div>
            )}
          </li>
        );
      })}
    </motion.ul>
  );
}

export function CategoryBreakdown({ data, currency }: { data: LabeledTotal[]; currency: string | null }) {
  const t = useTranslations("dashboard.categories");
  const tc = useTranslations("categories");
  return (
    <section aria-labelledby="cat-title" className="rounded-3xl border border-border/70 bg-card p-5 shadow-paper sm:p-6">
      <h2 id="cat-title" className="font-heading text-lg font-semibold">
        {t("title")}
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">{t("subtitle")}</p>
      {data.length ? (
        <RankedList
          rows={data}
          currency={currency}
          colored
          hrefFor={(l) => (isKnownCategory(l) ? `/receipts?category=${l}` : null)}
          labelFor={(l) => (isKnownCategory(l) ? tc(l) : tc("uncategorized"))}
          iconFor={(l) => <CategoryIcon category={l} className="size-9 rounded-lg" />}
        />
      ) : (
        <EmptyState compact pose="sleeping" title={t("empty")} />
      )}
    </section>
  );
}

export function MerchantBreakdown({ data, currency }: { data: LabeledTotal[]; currency: string | null }) {
  const t = useTranslations("dashboard.merchants");
  return (
    <section aria-labelledby="merchant-title" className={cn("rounded-3xl border border-border/70 bg-card p-5 shadow-paper sm:p-6")}>
      <h2 id="merchant-title" className="font-heading text-lg font-semibold">
        {t("title")}
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">{t("subtitle")}</p>
      {data.length ? (
        <RankedList
          rows={data}
          currency={currency}
          hrefFor={(l) => (l === "Unknown" ? null : `/receipts?merchant=${encodeURIComponent(l)}`)}
          labelFor={(l) => (l === "Unknown" ? t("unknown") : l)}
        />
      ) : (
        <EmptyState compact pose="sleeping" title={t("empty")} />
      )}
    </section>
  );
}
