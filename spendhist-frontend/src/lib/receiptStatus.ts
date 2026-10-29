import type { ReceiptStatus } from "@/types/api";

export const STATUS_LABEL: Record<ReceiptStatus, string> = {
  processing: "Processing",
  ready: "Ready",
  needs_review: "Needs review",
  failed: "Failed",
};

export const STATUS_VARIANT: Record<
  ReceiptStatus,
  "secondary" | "outline" | "destructive" | "default"
> = {
  processing: "outline",
  ready: "secondary",
  needs_review: "default",
  failed: "destructive",
};

const REASON_LABEL: Record<string, string> = {
  missing_merchant_name: "Merchant not found",
  missing_receipt_date: "Date not found",
  missing_total_amount: "Total not found",
  missing_currency: "Currency not found",
  invalid_total: "Total looks invalid",
  date_in_future: "Date is in the future",
  date_too_old: "Date is more than 2 years old",
  items_sum_mismatch: "Items don't add up to the total",
  possible_duplicate: "Possible duplicate of another receipt",
  not_a_receipt: "This doesn't look like a receipt",
  processing_error: "Couldn't read this file. Try reprocessing.",
};

/** Human label for a review reason code (extraction errors arrive as plain text). */
export function reasonLabel(code: string): string {
  return REASON_LABEL[code] ?? code;
}

export const CATEGORIES = [
  "groceries",
  "dining",
  "transport",
  "shopping",
  "bills",
  "health",
  "entertainment",
  "other",
] as const;

export function categoryLabel(c: string | null | undefined): string {
  if (!c) return "Uncategorized";
  return c.charAt(0).toUpperCase() + c.slice(1);
}
