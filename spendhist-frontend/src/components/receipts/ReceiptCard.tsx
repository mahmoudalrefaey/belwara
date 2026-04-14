"use client";

import type { ReceiptSummary } from "@/types/api";
import { money, fmtDate } from "@/lib/format";
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
  const merchant =
    receipt.merchant_name?.trim() || "Unknown Merchant";

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
            <CardTitle className="line-clamp-2 font-semibold">
              {merchant}
            </CardTitle>
            <Badge variant="secondary" className="shrink-0">
              {receipt.currency}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-1 pt-0 text-muted-foreground">
          <p className="text-sm">{fmtDate(receipt.receipt_date)}</p>
          <p className="text-base font-medium text-foreground">
            {money(receipt.total_amount, receipt.currency)}
          </p>
        </CardContent>
      </Card>
    </button>
  );
}
