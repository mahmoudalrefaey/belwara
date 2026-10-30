import type { ReceiptStatus } from "@/types/api";

export const STATUSES: ReceiptStatus[] = ["ready", "needs_review", "processing", "failed"];

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

export type Category = (typeof CATEGORIES)[number];

export function isKnownCategory(c: string | null | undefined): c is Category {
  return !!c && (CATEGORIES as readonly string[]).includes(c);
}

/** Review reasons the backend can emit; anything else is free text (shown as-is). */
export const REASONS = [
  "missing_merchant_name",
  "missing_receipt_date",
  "missing_total_amount",
  "missing_currency",
  "invalid_total",
  "date_in_future",
  "date_too_old",
  "items_sum_mismatch",
  "possible_duplicate",
  "not_a_receipt",
  "processing_error",
] as const;

export function isKnownReason(r: string): r is (typeof REASONS)[number] {
  return (REASONS as readonly string[]).includes(r);
}
