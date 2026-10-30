"use client";

import { useEffect, useRef } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { getUserId } from "@/lib/auth";
import { KEYS } from "@/lib/storage";
import { WalletParty } from "@/components/illustrations/Scenes";
import type { PaginatedReceiptsResponse, ReceiptStatus, ReceiptSummary } from "@/types/api";

const MILESTONES = [1, 10, 25, 50, 100, 250];

type ListData = PaginatedReceiptsResponse | InfiniteData<PaginatedReceiptsResponse>;

function pagesOf(data: ListData | undefined): PaginatedReceiptsResponse[] {
  if (!data) return [];
  return "pages" in data ? data.pages : [data];
}

/** Unfiltered list queries know the user's real receipt count. */
function isUnfiltered(key: readonly unknown[]): boolean {
  const params = (key[1] === "infinite" ? key[2] : key[1]) as Record<string, unknown> | undefined;
  if (!params) return false;
  return Object.keys(params).every((k) => k === "limit" || k === "offset" || k === "pageSize");
}

/**
 * Watches the receipts already being polled (no extra requests) and reacts to real changes:
 * a toast when extraction finishes, and a one-time celebration when the count crosses a milestone.
 */
export function useReceiptWatcher() {
  const qc = useQueryClient();
  const t = useTranslations("watch");
  const router = useRouter();
  const statuses = useRef(new Map<number, ReceiptStatus>());

  useEffect(() => {
    const userId = getUserId();
    const cache = qc.getQueryCache();

    const check = () => {
      let total: number | null = null;
      const seen = new Map<number, ReceiptSummary>();
      for (const q of cache.findAll({ queryKey: ["receipts"] })) {
        const pages = pagesOf(q.state.data as ListData | undefined);
        for (const page of pages) for (const r of page.items) seen.set(r.receipt_id, r);
        if (pages.length && isUnfiltered(q.queryKey)) total = Math.max(total ?? 0, pages[0].total);
      }

      for (const [id, r] of seen) {
        const before = statuses.current.get(id);
        if (before === "processing" && r.status !== "processing") {
          const merchant = r.merchant_name?.trim() || t("aReceipt");
          const open = () => {
            if (window.location.pathname.endsWith("/receipts")) {
              // Already on the list: open the detail in place (keeps filters).
              const next = new URLSearchParams(window.location.search);
              next.set("open", String(id));
              window.history.replaceState(null, "", `${window.location.pathname}?${next}`);
            } else {
              router.push(`/receipts?open=${id}`);
            }
          };
          if (r.status === "ready") {
            toast.success(t("ready", { merchant }), { action: { label: t("open"), onClick: open } });
          } else if (r.status === "needs_review") {
            toast.warning(t("needsReview", { merchant }), {
              description: t("needsReviewHint"),
              action: { label: t("review"), onClick: open },
            });
          } else if (r.status === "failed") {
            toast.error(t("failed"), { action: { label: t("open"), onClick: open } });
          }
        }
        statuses.current.set(id, r.status);
      }

      if (userId && total != null) {
        const key = KEYS.milestone(userId);
        const stored = localStorage.getItem(key);
        const reached = MILESTONES.filter((m) => m <= total!).at(-1) ?? 0;
        if (stored == null) {
          // First visit after this feature shipped: remember silently, never celebrate old history.
          localStorage.setItem(key, String(reached));
        } else if (reached > Number(stored)) {
          localStorage.setItem(key, String(reached));
          toast.custom(
            () => (
              <div className="flex w-[340px] max-w-[calc(100vw-2rem)] items-center gap-4 rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-lift">
                <WalletParty className="w-16 shrink-0 text-ink dark:text-bone" />
                <div className="space-y-0.5">
                  <p className="font-heading font-semibold">
                    {reached === 1 ? t("milestone.first") : t("milestone.count", { n: String(reached) })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {reached === 1 ? t("milestone.firstHint") : t("milestone.countHint")}
                  </p>
                </div>
              </div>
            ),
            { duration: 6000 },
          );
        }
      }
    };

    check();
    return cache.subscribe((event) => {
      if (event.type === "updated" && event.query.queryKey[0] === "receipts") check();
    });
  }, [qc, t, router]);
}
