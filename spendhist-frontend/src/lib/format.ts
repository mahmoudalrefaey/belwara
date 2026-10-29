import { format, parseISO } from "date-fns";

export function num(v: number | string | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "string" ? parseFloat(v) || 0 : v;
}

export function money(
  amount: number | string | null | undefined,
  currency?: string,
): string {
  const n = num(amount);
  const formatted = n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${formatted} ${currency}` : formatted;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "MMM d, yyyy h:mm a");
  } catch {
    return iso;
  }
}

export function currencySymbol(code: string): string {
  const symbols: Record<string, string> = {
    EGP: "E£",
    USD: "$",
    SAR: "﷼",
    EUR: "€",
    GBP: "£",
  };
  return symbols[code?.toUpperCase()] ?? code;
}
