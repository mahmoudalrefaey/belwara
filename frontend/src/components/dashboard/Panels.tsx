"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft, Camera, MessagesSquare, ScanLine } from "lucide-react";
import type { ReceiptSummary } from "@/types/api";
import { Link } from "@/i18n/navigation";
import { useUpload } from "@/components/layout/UploadProvider";
import { Wara } from "@/components/illustrations/Wara";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import { Money } from "@/components/common/Money";
import { Reveal, RevealItem } from "@/components/common/Reveal";
import { Stamp } from "@/components/common/Stamp";
import { Button } from "@/components/ui/button";
import { useFormat } from "@/lib/format";

export function ReviewBanner({ count }: { count: number }) {
  const t = useTranslations("dashboard.review");
  return (
    <Link
      href="/receipts?status=needs_review"
      className="group flex items-center gap-4 overflow-hidden rounded-3xl border border-warning/30 bg-warning-soft p-3 pe-5 transition-transform hover:-translate-y-0.5"
    >
      <Wara pose="squint" className="-mb-4 w-16 shrink-0 text-ink dark:text-bone" animated={false} />
      <div className="min-w-0 flex-1">
        <p className="font-heading font-semibold text-foreground">{t("title", { count, n: String(count) })}</p>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <span className="hidden items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background sm:inline-flex">
        {t("action")}
        <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5 ltr:rotate-180" aria-hidden />
      </span>
    </Link>
  );
}

export function RecentReceipts({ items }: { items: ReceiptSummary[] }) {
  const t = useTranslations("dashboard.recent");
  const f = useFormat();
  return (
    <section aria-labelledby="recent-title" className="rounded-3xl border border-border/70 bg-card p-5 shadow-paper sm:p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="recent-title" className="font-heading text-lg font-semibold">
          {t("title")}
        </h2>
        <Link href="/receipts" className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          {t("all")}
        </Link>
      </div>
      <Reveal as="ul" className="divide-y divide-dashed divide-border" step={0.04}>
        {items.map((r) => (
          <RevealItem as="li" key={r.receipt_id}>
            <Link
              href={`/receipts?open=${r.receipt_id}`}
              className="flex items-center gap-3 rounded-xl px-1 py-3 transition-colors hover:bg-muted/60"
            >
              <CategoryIcon category={r.category} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium bidi" dir="auto">
                  {r.merchant_name?.trim() || (r.status === "processing" ? t("reading") : t("unknown"))}
                </p>
                <p className="text-xs text-muted-foreground">{f.date(r.receipt_date ?? r.created_at)}</p>
              </div>
              {r.status === "ready" ? (
                <Money amount={r.total_amount} currency={r.currency} className="font-medium" />
              ) : (
                <Stamp status={r.status} size="sm" />
              )}
            </Link>
          </RevealItem>
        ))}
      </Reveal>
    </section>
  );
}

/** First run: no numbers to show yet, so show the path instead. */
export function FirstRun({ name }: { name?: string | null }) {
  const t = useTranslations("dashboard.firstRun");
  const { openUpload } = useUpload();
  const steps = [
    { icon: Camera, key: "snap" },
    { icon: ScanLine, key: "read" },
    { icon: MessagesSquare, key: "ask" },
  ] as const;
  return (
    <section className="overflow-hidden rounded-3xl bg-ink text-bone shadow-lift dark:bg-ink-2 dark:ring-1 dark:ring-inset dark:ring-white/10">
      <div className="grid items-center gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_auto]">
        <div className="space-y-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-lime">{t("eyebrow")}</p>
          <h2 className="font-heading text-3xl font-bold leading-tight sm:text-4xl">
            {name ? t("titleNamed", { name }) : t("title")}
          </h2>
          <p className="max-w-lg text-bone/70">{t("subtitle")}</p>
          <Button size="lg" onClick={openUpload}>
            <Camera className="size-5" />
            {t("cta")}
          </Button>
        </div>
        <Wara pose="hello" className="mx-auto w-40 text-bone sm:w-52" />
      </div>
      <ol className="grid border-t border-white/10 sm:grid-cols-3">
        {steps.map(({ icon: Icon, key }, i) => (
          <li key={key} className="flex gap-4 border-white/10 p-6 not-last:border-b sm:not-last:border-b-0 sm:not-last:border-e">
            <span className="num text-sm text-lime">0{i + 1}</span>
            <div className="space-y-1">
              <p className="flex items-center gap-2 font-heading font-semibold">
                <Icon className="size-4" aria-hidden />
                {t(`steps.${key}.title`)}
              </p>
              <p className="text-sm text-bone/65">{t(`steps.${key}.body`)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
