"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Wara } from "@/components/illustrations/Wara";

const QUESTIONS = ["thisMonth", "topMerchant", "compare", "biggest"] as const;

/** Hand-off to the AI assistant. Labelled as AI so it never blends with computed facts. */
export function AskChips() {
  const t = useTranslations("dashboard.ask");
  return (
    <section
      aria-labelledby="ask-title"
      className="relative overflow-hidden rounded-3xl border border-border/70 bg-card p-5 shadow-paper"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-lime px-2.5 py-1 text-[11px] font-semibold text-ink">
            <Sparkles className="size-3.5" aria-hidden />
            {t("badge")}
          </span>
          <h2 id="ask-title" className="pt-2 font-heading text-lg font-semibold">
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Wara pose="hello" className="-mb-2 w-16 shrink-0 text-ink dark:text-bone" animated={false} />
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        {QUESTIONS.map((q) => (
          <li key={q}>
            <Link
              href={`/chat?q=${encodeURIComponent(t(`q.${q}`))}`}
              className="group flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3 text-sm font-medium transition-[border-color,background-color] hover:border-foreground/40 hover:bg-muted/60"
            >
              {t(`q.${q}`)}
              <ArrowLeft className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 ltr:group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
