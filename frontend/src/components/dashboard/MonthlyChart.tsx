"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { endOfMonth, format } from "date-fns";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LabeledTotal } from "@/types/api";
import { useRouter } from "@/i18n/navigation";
import { EmptyState } from "@/components/common/EmptyState";
import { useFormat } from "@/lib/format";

/** Monthly totals. Hover/tap shows exact values; clicking a month opens that month's receipts. */
export function MonthlyChart({ data, currency }: { data: LabeledTotal[]; currency: string | null }) {
  const t = useTranslations("dashboard.monthly");
  const f = useFormat();
  const router = useRouter();
  const [active, setActive] = useState<number | null>(null);
  const rtl = f.locale === "ar";

  const rows = data.map((m) => ({ ...m, name: f.month(m.label) }));
  const peak = rows.reduce((best, r) => (r.total > best.total ? r : best), rows[0] ?? { total: 0, label: "" });
  const latest = rows.at(-1);

  const openMonth = (label: string) => {
    const [y, m] = label.split("-").map(Number);
    if (!y || !m) return;
    const start = format(new Date(y, m - 1, 1), "yyyy-MM-dd");
    const end = format(endOfMonth(new Date(y, m - 1, 1)), "yyyy-MM-dd");
    router.push(`/receipts?start=${start}&end=${end}`);
  };

  return (
    <section aria-labelledby="monthly-title" className="rounded-3xl border border-border/70 bg-card p-5 shadow-paper sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="monthly-title" className="font-heading text-lg font-semibold">
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {latest && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {active != null && rows[active] ? (
              <>
                <span className="font-medium text-foreground">{f.month(rows[active].label, true)}</span>
                {" · "}
                <span className="num text-foreground">{f.money(rows[active].total, currency)}</span>
              </>
            ) : (
              t("hint")
            )}
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState compact pose="sleeping" title={t("empty")} />
      ) : (
        <>
          <p className="sr-only">
            {t("summary", {
              count: rows.length,
              n: String(rows.length),
              peak: f.month(peak.label, true),
              peakAmount: f.money(peak.total, currency),
            })}
          </p>
          <div className="mt-4 h-60" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
                margin={{ top: 8, right: 4, left: 4, bottom: 0 }}
                onMouseLeave={() => setActive(null)}
              >
                <XAxis
                  dataKey="name"
                  reversed={rtl}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  orientation={rtl ? "right" : "left"}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={(v: number) => f.compact(v)}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)", radius: 10 }}
                  content={({ active: on, payload }) =>
                    on && payload?.[0] ? (
                      <div className="rounded-xl border border-border bg-popover px-3 py-2 text-sm shadow-lift">
                        <p className="text-muted-foreground">{f.month(String(payload[0].payload.label), true)}</p>
                        <p className="num font-semibold">{f.money(Number(payload[0].value), currency)}</p>
                        <p className="mt-1 text-xs text-brand-text">{t("clickToOpen")}</p>
                      </div>
                    ) : null
                  }
                />
                <Bar
                  dataKey="total"
                  radius={[10, 10, 4, 4]}
                  maxBarSize={44}
                  cursor="pointer"
                  onMouseEnter={(_, i) => setActive(i)}
                  onClick={(d) => openMonth(String((d as unknown as { label: string }).label))}
                >
                  {rows.map((r, i) => (
                    <Cell
                      key={r.label}
                      fill={i === rows.length - 1 || i === active ? "var(--chart-1)" : "var(--muted-foreground)"}
                      fillOpacity={i === rows.length - 1 || i === active ? 1 : 0.28}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Keyboard path to the same drill-down. */}
          <ul className="sr-only">
            {rows.map((r) => (
              <li key={r.label}>
                <button type="button" onClick={() => openMonth(r.label)}>
                  {f.month(r.label, true)}: {f.money(r.total, currency)}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
