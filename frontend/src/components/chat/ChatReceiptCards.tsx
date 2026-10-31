"use client";

import { useTranslations } from "next-intl";
import { ArrowUpLeft } from "lucide-react";
import type { ChatReceiptCard } from "@/types/api";
import { Link } from "@/i18n/navigation";
import { Money } from "@/components/common/Money";
import { useFormat } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Receipts Wara'a attached to a reply: each one opens on the Receipts page. */
export function ChatReceiptCards({ receipts }: { receipts: ChatReceiptCard[] }) {
  const t = useTranslations("chat.cards");
  const ts = useTranslations("status.label");
  const f = useFormat();
  if (!receipts.length) return null;
  return (
    <ul className="grid gap-2 sm:grid-cols-2" aria-label={t("label")}>
      {receipts.map((r) => (
        <li key={r.receipt_id}>
          <Link
            href={`/receipts?open=${r.receipt_id}`}
            className={cn(
              "group flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-3.5 py-2.5 text-sm shadow-paper",
              "outline-none transition-colors hover:border-ink/30 focus-visible:ring-2 focus-visible:ring-lime",
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.merchant || t("unknownMerchant")}</p>
              <p className="text-xs text-muted-foreground">
                {r.date ? f.date(r.date) : t("noDate")}
                {r.status === "needs_review" && (
                  <span className="ms-2 rounded-full bg-lime/30 px-1.5 py-0.5 font-medium text-ink dark:text-bone">
                    {ts("needs_review")}
                  </span>
                )}
              </p>
            </div>
            <Money amount={r.total} currency={r.currency} className="text-sm font-semibold" />
            <ArrowUpLeft className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 ltr:-scale-x-100" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
