"use client";

import { useMemo } from "react";
import { useLocale } from "next-intl";
import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { arEG, enUS } from "date-fns/locale";

export function num(v: number | string | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "string" ? parseFloat(v) || 0 : v;
}

/** Arabic copy with Latin digits for money: easier to scan, and what Egyptian finance apps use. */
function intlLocale(locale: string) {
  return locale === "ar" ? "ar-EG-u-nu-latn" : "en-US";
}

export function money(
  amount: number | string | null | undefined,
  currency?: string | null,
  locale = "en",
): string {
  const formatted = num(amount).toLocaleString(intlLocale(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${formatted} ${currency}` : formatted;
}

export function compact(amount: number, locale = "en"): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

export function integer(n: number, locale = "en"): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(n);
}

function dfLocale(locale: string) {
  return locale === "ar" ? arEG : enUS;
}

function safe(iso: string | null | undefined, fn: (d: Date) => string): string {
  if (!iso) return "—";
  try {
    return fn(parseISO(iso));
  } catch {
    return iso;
  }
}

export function fmtDate(iso: string | null | undefined, locale = "en"): string {
  // Arabic short months ("أكت") read oddly; use full month names there.
  return safe(iso, (d) => format(d, locale === "ar" ? "d MMMM yyyy" : "d MMM yyyy", { locale: dfLocale(locale) }));
}

export function fmtDateTime(iso: string | null | undefined, locale = "en"): string {
  return safe(iso, (d) =>
    format(d, locale === "ar" ? "d MMMM yyyy · h:mm a" : "d MMM yyyy · h:mm a", { locale: dfLocale(locale) }),
  );
}

export function fmtRelative(iso: string | null | undefined, locale = "en"): string {
  return safe(iso, (d) =>
    Date.now() - d.getTime() < 45_000
      ? locale === "ar"
        ? "دلوقتي"
        : "just now"
      : formatDistanceToNowStrict(d, { addSuffix: true, locale: dfLocale(locale) }),
  );
}

/** "2026-10" → "Oct" / "أكتوبر" (or with the year when `withYear`). */
export function fmtMonth(label: string, locale = "en", withYear = false): string {
  const [y, m] = label.split("-").map(Number);
  if (!y || !m) return label;
  return format(new Date(y, m - 1, 1), withYear ? "MMMM yyyy" : locale === "ar" ? "MMMM" : "MMM", {
    locale: dfLocale(locale),
  });
}

/** Formatting helpers bound to the current UI language. */
export function useFormat() {
  const locale = useLocale();
  return useMemo(
    () => ({
      locale,
      money: (a: number | string | null | undefined, c?: string | null) => money(a, c, locale),
      compact: (a: number) => compact(a, locale),
      integer: (n: number) => integer(n, locale),
      date: (iso: string | null | undefined) => fmtDate(iso, locale),
      dateTime: (iso: string | null | undefined) => fmtDateTime(iso, locale),
      relative: (iso: string | null | undefined) => fmtRelative(iso, locale),
      month: (label: string, withYear = false) => fmtMonth(label, locale, withYear),
    }),
    [locale],
  );
}
