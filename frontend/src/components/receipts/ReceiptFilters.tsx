"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { CalendarRange, Store, X } from "lucide-react";
import type { ReceiptStatus } from "@/types/api";
import type { ReceiptFilters as Filters } from "@/hooks/useReceipts";
import { CATEGORIES, STATUSES, isKnownCategory } from "@/lib/receiptStatus";
import { useFormat } from "@/lib/format";
import { cn } from "@/lib/utils";

const iso = (d: Date) => format(d, "yyyy-MM-dd");

function presets(now = new Date()) {
  return {
    thisMonth: { start: iso(startOfMonth(now)), end: iso(endOfMonth(now)) },
    lastMonth: { start: iso(startOfMonth(subMonths(now, 1))), end: iso(endOfMonth(subMonths(now, 1))) },
    last3: { start: iso(startOfMonth(subMonths(now, 2))), end: iso(endOfMonth(now)) },
  } as const;
}

function Chip({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-[background-color,border-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-foreground hover:border-foreground/40",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Filters map 1:1 to GET /receipts query params and live in the URL (shareable, back-button safe). */
export function ReceiptFilters({
  value,
  onChange,
  disabled = false,
}: {
  value: Filters;
  onChange: (next: Filters) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("receipts.filters");
  const ts = useTranslations("status");
  const tc = useTranslations("categories");
  const f = useFormat();
  const p = presets();
  const presetKey = (Object.keys(p) as (keyof typeof p)[]).find(
    (k) => p[k].start === value.start && p[k].end === value.end,
  );
  const [customOpen, setCustomOpen] = useState(!!value.start && !presetKey);

  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch });
  const hasAny = Object.values(value).some(Boolean);

  return (
    <div className={cn("space-y-3", disabled && "pointer-events-none opacity-50")} aria-disabled={disabled}>
      {/* Status */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={t("status")}>
        <Chip active={!value.status} onClick={() => set({ status: undefined })}>
          {t("allStatuses")}
        </Chip>
        {STATUSES.map((s) => (
          <Chip key={s} active={value.status === s} onClick={() => set({ status: value.status === s ? undefined : (s as ReceiptStatus) })}>
            {ts(`label.${s}`)}
          </Chip>
        ))}
      </div>

      {/* Category */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={t("category")}>
        {CATEGORIES.map((c) => (
          <Chip key={c} active={value.category === c} onClick={() => set({ category: value.category === c ? undefined : c })}>
            {tc(c)}
          </Chip>
        ))}
      </div>

      {/* Dates */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("dates")}>
        {(Object.keys(p) as (keyof typeof p)[]).map((k) => (
          <Chip
            key={k}
            active={presetKey === k}
            onClick={() => {
              setCustomOpen(false);
              set(presetKey === k ? { start: undefined, end: undefined } : { ...p[k] });
            }}
          >
            {t(`presets.${k}`)}
          </Chip>
        ))}
        <Chip active={customOpen} onClick={() => setCustomOpen((o) => !o)}>
          <CalendarRange className="size-4" aria-hidden />
          {t("custom")}
        </Chip>
        {customOpen && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="f-start">{t("from")}</label>
            <input
              id="f-start"
              type="date"
              value={value.start ?? ""}
              max={value.end}
              onChange={(e) => set({ start: e.target.value || undefined })}
              className="h-9 rounded-full border border-border bg-card px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
            />
            <span className="text-muted-foreground">–</span>
            <label className="sr-only" htmlFor="f-end">{t("to")}</label>
            <input
              id="f-end"
              type="date"
              value={value.end ?? ""}
              min={value.start}
              onChange={(e) => set({ end: e.target.value || undefined })}
              className="h-9 rounded-full border border-border bg-card px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
            />
          </div>
        )}
      </div>

      {/* Active summary */}
      {hasAny && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {value.merchant && (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-lime ps-3 pe-1 font-medium text-ink">
              <Store className="size-3.5" aria-hidden />
              {value.merchant}
              <button
                type="button"
                onClick={() => set({ merchant: undefined })}
                aria-label={t("removeMerchant")}
                className="grid size-6 cursor-pointer place-items-center rounded-full hover:bg-ink/10"
              >
                <X className="size-3.5" />
              </button>
            </span>
          )}
          {value.start && value.end && !presetKey && (
            <span className="text-muted-foreground">
              {f.date(value.start)} – {f.date(value.end)}
            </span>
          )}
          {value.category && !isKnownCategory(value.category) && (
            <span className="text-muted-foreground">{value.category}</span>
          )}
          <button
            type="button"
            onClick={() => {
              setCustomOpen(false);
              onChange({});
            }}
            className="cursor-pointer font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            {t("clear")}
          </button>
        </div>
      )}
    </div>
  );
}
