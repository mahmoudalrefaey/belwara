"use client";

import { useTranslations } from "next-intl";
import { format, subMonths } from "date-fns";
import { ArrowDownRight, ArrowUpRight, Calculator, Store } from "lucide-react";
import type { DashboardResponse } from "@/types/api";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import { Money } from "@/components/common/Money";
import { Reveal, RevealItem } from "@/components/common/Reveal";
import { isKnownCategory } from "@/lib/receiptStatus";
import { Link } from "@/i18n/navigation";

/**
 * Plain facts computed from the user's own numbers: no AI, no guesses.
 * Each one only appears when the data to back it exists.
 */
export function Insights({ data }: { data: DashboardResponse }) {
  const t = useTranslations("dashboard.insights");
  const tc = useTranslations("categories");
  const cur = data.currency;

  const now = new Date();
  const thisKey = format(now, "yyyy-MM");
  const prevKey = format(subMonths(now, 1), "yyyy-MM");
  const thisMonth = data.by_month.find((m) => m.label === thisKey)?.total ?? 0;
  const lastMonth = data.by_month.find((m) => m.label === prevKey)?.total ?? 0;

  const topCat = data.by_category.find((c) => c.label !== "Unknown" && c.total > 0);
  const topMerchant = data.by_merchant.find((m) => m.label !== "Unknown" && m.total > 0);

  const items: React.ReactNode[] = [];

  if (topCat && data.total > 0) {
    const pct = Math.round((topCat.total / data.total) * 100);
    const label = isKnownCategory(topCat.label) ? tc(topCat.label) : topCat.label;
    items.push(
      <Link
        key="cat"
        href={`/receipts?category=${encodeURIComponent(topCat.label)}`}
        className="group flex items-center gap-4 rounded-2xl p-3 transition-colors hover:bg-muted"
      >
        <CategoryIcon category={topCat.label} className="bg-lime text-ink" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{t("topCategory")}</p>
          <p className="truncate font-medium">
            {label} · <span className="num">{pct}%</span>
          </p>
        </div>
        <Money amount={topCat.total} currency={cur} className="text-sm font-medium" />
      </Link>,
    );
  }

  if (topMerchant) {
    items.push(
      <Link
        key="merchant"
        href={`/receipts?merchant=${encodeURIComponent(topMerchant.label)}`}
        className="group flex items-center gap-4 rounded-2xl p-3 transition-colors hover:bg-muted"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted">
          <Store className="size-[18px]" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{t("topMerchant")}</p>
          <p className="truncate font-medium bidi" dir="auto">{topMerchant.label}</p>
        </div>
        <Money amount={topMerchant.total} currency={cur} className="text-sm font-medium" />
      </Link>,
    );
  }

  if (thisMonth > 0 && lastMonth > 0) {
    const change = Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
    const up = change > 0;
    const Icon = up ? ArrowUpRight : ArrowDownRight;
    items.push(
      <div key="compare" className="flex items-center gap-4 rounded-2xl p-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted">
          <Icon className="size-[18px] rtl:-scale-x-100" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{t("vsLastMonth")}</p>
          <p className="font-medium">
            {change === 0
              ? t("same")
              : up
                ? t("higher", { pct: String(Math.abs(change)) })
                : t("lower", { pct: String(Math.abs(change)) })}
          </p>
          <p className="text-xs text-muted-foreground">{t("partialMonth")}</p>
        </div>
      </div>,
    );
  }

  if (data.receipts > 0) {
    items.push(
      <div key="avg" className="flex items-center gap-4 rounded-2xl p-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted font-mono text-sm font-semibold">
          ⌀
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{t("average")}</p>
          <p className="text-xs text-muted-foreground">{t("averageOf", { count: data.receipts, n: data.receipts.toLocaleString("en-US") })}</p>
        </div>
        <Money amount={data.average} currency={cur} className="text-sm font-medium" />
      </div>,
    );
  }

  return (
    <section aria-labelledby="insights-title" className="flex flex-col rounded-3xl border border-border/70 bg-card p-4 shadow-paper sm:p-5">
      <div className="flex items-center justify-between px-3 pb-2">
        <h2 id="insights-title" className="font-heading text-lg font-semibold">
          {t("title")}
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <Calculator className="size-3.5" aria-hidden />
          {t("fromYourReceipts")}
        </span>
      </div>
      {items.length ? (
        <Reveal className="divide-y divide-border/60" step={0.05}>
          {items.map((node, i) => (
            <RevealItem key={i}>{node}</RevealItem>
          ))}
        </Reveal>
      ) : (
        <p className="px-3 py-6 text-sm text-muted-foreground">{t("notEnough")}</p>
      )}
    </section>
  );
}
