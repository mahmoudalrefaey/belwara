"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Camera, Loader2, Search, X } from "lucide-react";
import type { ReceiptStatus, ReceiptSummary } from "@/types/api";
import {
  useReceiptSearch,
  useReceiptsInfinite,
  type ReceiptFilters as Filters,
} from "@/hooks/useReceipts";
import { useUpload } from "@/components/layout/UploadProvider";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import ReceiptCard from "@/components/receipts/ReceiptCard";
import ReceiptDetail from "@/components/receipts/ReceiptDetail";
import { ReceiptFilters } from "@/components/receipts/ReceiptFilters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useFormat } from "@/lib/format";
import { STATUSES } from "@/lib/receiptStatus";
import { ease } from "@/lib/motion";

const PAGE_SIZE = 24;

function Grid({ items, onOpen, selected }: { items: ReceiptSummary[]; onOpen: (id: number) => void; selected: number | null }) {
  return (
    <ul className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((r, i) => (
        <motion.li
          key={r.receipt_id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: Math.min(i % PAGE_SIZE, 10) * 0.035, ease: ease.out }}
        >
          <ReceiptCard receipt={r} onOpen={() => onOpen(r.receipt_id)} selected={selected === r.receipt_id} />
        </motion.li>
      ))}
    </ul>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-44 rounded-2xl" />
      ))}
    </div>
  );
}

function ReceiptsView() {
  const t = useTranslations("receipts");
  const f = useFormat();
  const params = useSearchParams();
  const { openUpload } = useUpload();

  const filters: Filters = useMemo(() => {
    const status = params.get("status");
    return {
      status: STATUSES.includes(status as ReceiptStatus) ? (status as ReceiptStatus) : undefined,
      category: params.get("category") ?? undefined,
      merchant: params.get("merchant") ?? undefined,
      start: params.get("start") ?? undefined,
      end: params.get("end") ?? undefined,
    };
  }, [params]);
  const q = params.get("q") ?? "";
  const openId = Number(params.get("open")) || null;

  const [search, setSearch] = useState(q);

  // Filters and the open receipt live in the query string. Native history updates keep
  // useSearchParams in sync without a server round-trip, so changes feel instant.
  const replaceParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      const s = next.toString();
      window.history.replaceState(null, "", s ? `${window.location.pathname}?${s}` : window.location.pathname);
    },
    [],
  );

  // Debounce typing into the URL.
  useEffect(() => {
    const id = setTimeout(() => {
      if (search.trim() !== q) replaceParams({ q: search.trim() || undefined });
    }, 350);
    return () => clearTimeout(id);
  }, [search, q, replaceParams]);

  const searching = q.length > 0;
  const list = useReceiptsInfinite(filters, PAGE_SIZE);
  const found = useReceiptSearch(q, 60);

  const items = searching ? found.data?.items ?? [] : list.data?.pages.flatMap((p) => p.items) ?? [];
  const total = searching ? found.data?.total ?? 0 : list.data?.pages[0]?.total ?? 0;
  const isLoading = searching ? found.isLoading : list.isLoading;
  const isError = searching ? found.isError : list.isError;
  const filtered = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button onClick={openUpload}>
            <Camera className="size-4" />
            {t("upload")}
          </Button>
        }
      />

      <div className="space-y-4 rounded-3xl border border-border/70 bg-card/60 p-4 sm:p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchLabel")}
            className="h-12 rounded-full ps-11 pe-11"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label={t("clearSearch")}
              className="absolute end-2 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <ReceiptFilters
          value={filters}
          disabled={searching}
          onChange={(next) =>
            replaceParams({
              status: next.status,
              category: next.category,
              merchant: next.merchant,
              start: next.start,
              end: next.end,
            })
          }
        />
        {searching && <p className="text-xs text-muted-foreground">{t("searchIgnoresFilters")}</p>}
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground" aria-live="polite">
        {!isLoading && !isError && (
          <span>{searching ? t("results", { count: total, n: f.integer(total) }) : t("count", { count: total, n: f.integer(total) })}</span>
        )}
      </div>

      {isLoading ? (
        <GridSkeleton />
      ) : isError ? (
        <EmptyState
          pose="crumpled"
          title={t("error.title")}
          description={t("error.body")}
          action={<Button onClick={() => (searching ? found.refetch() : list.refetch())}>{t("error.retry")}</Button>}
        />
      ) : items.length === 0 ? (
        searching || filtered ? (
          <EmptyState
            pose="squint"
            title={searching ? t("noResults.title", { q }) : t("noMatches.title")}
            description={t("noMatches.body")}
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  window.history.replaceState(null, "", window.location.pathname);
                }}
              >
                {t("noMatches.clear")}
              </Button>
            }
          />
        ) : (
          <EmptyState
            pose="sleeping"
            title={t("empty.title")}
            description={t("empty.body")}
            action={
              <Button size="lg" onClick={openUpload}>
                <Camera className="size-5" />
                {t("empty.cta")}
              </Button>
            }
          />
        )
      ) : (
        <>
          <Grid items={items} onOpen={(id) => replaceParams({ open: String(id) })} selected={openId} />
          {!searching && list.hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="lg" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>
                {list.isFetchingNextPage && <Loader2 className="size-4 animate-spin" />}
                {t("loadMore", { shown: f.integer(items.length), total: f.integer(total) })}
              </Button>
            </div>
          )}
        </>
      )}

      {openId != null && (
        <ReceiptDetail receiptId={openId} open onClose={() => replaceParams({ open: undefined })} />
      )}
    </div>
  );
}

export default function ReceiptsPage() {
  return (
    <Suspense fallback={<GridSkeleton />}>
      <ReceiptsView />
    </Suspense>
  );
}
