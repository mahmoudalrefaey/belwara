"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpLeft } from "lucide-react";
import type { ReceiptSummary } from "@/types/api";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import { Money } from "@/components/common/Money";
import { Stamp } from "@/components/common/Stamp";
import { Wara } from "@/components/illustrations/Wara";
import { useFormat } from "@/lib/format";
import { isKnownCategory } from "@/lib/receiptStatus";
import { cn } from "@/lib/utils";

/** A receipt as a piece of paper: torn edge, printed total, rubber-stamp status. */
export default function ReceiptCard({
  receipt,
  onOpen,
  selected = false,
}: {
  receipt: ReceiptSummary;
  onOpen: () => void;
  selected?: boolean;
}) {
  const t = useTranslations("receipts.card");
  const tc = useTranslations("categories");
  const f = useFormat();
  const processing = receipt.status === "processing";
  // Briefly show the "ready" stamp when a receipt finishes reading in front of the user.
  const [prevStatus, setPrevStatus] = useState(receipt.status);
  const [fresh, setFresh] = useState(false);
  if (receipt.status !== prevStatus) {
    setPrevStatus(receipt.status);
    if (prevStatus === "processing") setFresh(true);
  }
  useEffect(() => {
    if (!fresh) return;
    const id = setTimeout(() => setFresh(false), 4000);
    return () => clearTimeout(id);
  }, [fresh]);
  const failed = receipt.status === "failed";
  const title =
    receipt.merchant_name?.trim() ||
    (processing || failed ? receipt.source_filename : null) ||
    t("unknownMerchant");

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t("open", { name: title })}
      className={cn(
        "group relative block w-full cursor-pointer text-start outline-none transition-transform duration-200 ease-[var(--ease-out-soft)] hover:-translate-y-1 focus-visible:-translate-y-1",
        "drop-shadow-[0_1px_1px_rgb(10_10_11/0.08)] hover:drop-shadow-[0_14px_18px_rgb(10_10_11/0.16)] dark:drop-shadow-none",
      )}
    >
      <div
        className={cn(
          "edge-torn relative overflow-hidden rounded-t-2xl border-x border-t border-border/70 bg-card px-5 pb-8 pt-5",
          "group-focus-visible:bg-lime/15",
          selected && "bg-lime/15",
        )}
      >
        {processing && (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-10 animate-scan bg-gradient-to-b from-transparent via-lime/40 to-transparent" />
        )}

        <div className="flex items-start gap-3">
          {processing ? (
            <Wara pose="reading" className="-my-1 w-11 shrink-0 text-ink dark:text-bone" />
          ) : failed ? (
            <Wara pose="crumpled" className="-my-1 w-11 shrink-0 text-ink dark:text-bone" animated={false} />
          ) : (
            <CategoryIcon category={receipt.category} />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-[17px] font-semibold leading-snug bidi" dir="auto">{title}</p>
            <p className="truncate text-sm text-muted-foreground">
              {processing
                ? t("reading")
                : failed
                  ? t("failed")
                  : [
                      f.date(receipt.receipt_date),
                      receipt.category && isKnownCategory(receipt.category) ? tc(receipt.category) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
            </p>
          </div>
          <ArrowUpLeft
            className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ltr:-scale-x-100"
            aria-hidden
          />
        </div>

        <div className="my-4 border-t-2 border-dashed border-border" />

        <div className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-end gap-2 text-sm text-muted-foreground">
            <span>{t("total")}</span>
            <span className="leader" aria-hidden />
          </div>
          {processing ? (
            <span className="num shimmer-text text-lg">— — —</span>
          ) : (
            <Money
              amount={receipt.total_amount}
              currency={receipt.currency}
              className="text-xl font-semibold text-foreground"
            />
          )}
        </div>

        {(receipt.status !== "ready" || fresh) && (
          <div className="mt-3 flex justify-end">
            <Stamp status={receipt.status} size="sm" animateIn={fresh} />
          </div>
        )}
      </div>
    </button>
  );
}
