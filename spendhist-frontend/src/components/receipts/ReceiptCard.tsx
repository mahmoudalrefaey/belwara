"use client";

import { Loader2 } from "lucide-react";
import type { ReceiptSummary } from "@/types/api";
import { money, fmtDate } from "@/lib/format";
import { STATUS_LABEL, STATUS_VARIANT, categoryLabel } from "@/lib/receiptStatus";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ReceiptCardProps = {
  receipt: ReceiptSummary;
  onClick: () => void;
  selected?: boolean;
};

export default function ReceiptCard({
  receipt,
  onClick,
  selected = false,
}: ReceiptCardProps) {
  const processing = receipt.status === "processing";
  const title =
    receipt.merchant_name?.trim() ||
    (processing ? receipt.source_filename : null) ||
    "Unknown Merchant";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left transition-transform active:scale-[0.99]"
    >
      <Card
        className={cn(
          "cursor-pointer border border-transparent shadow-sm transition-[box-shadow,border-color,ring]",
          "hover:border-primary/20 hover:shadow-md",
          selected && "border-primary/40 shadow-md ring-2 ring-primary/30",
        )}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-2 font-semibold">{title}</CardTitle>
            <div className="flex shrink-0 gap-1">
              {receipt.status !== "ready" && (
                <Badge variant={STATUS_VARIANT[receipt.status]}>
                  {processing && <Loader2 className="animate-spin" />}
                  {STATUS_LABEL[receipt.status]}
                </Badge>
              )}
              {receipt.currency && (
                <Badge variant="secondary">{receipt.currency}</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-1 pt-0 text-muted-foreground">
          {processing ? (
            <p className="text-sm">Reading your receipt…</p>
          ) : (
            <>
              <p className="text-sm">
                {fmtDate(receipt.receipt_date)}
                {receipt.category && ` · ${categoryLabel(receipt.category)}`}
              </p>
              <p className="text-base font-medium text-foreground">
                {receipt.total_amount != null
                  ? money(receipt.total_amount, receipt.currency ?? undefined)
                  : "—"}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </button>
  );
}
