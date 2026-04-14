"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Upload } from "lucide-react";
import {
  useReceipts,
  useReceiptSearch,
} from "@/hooks/useReceipts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ReceiptSearch from "@/components/receipts/ReceiptSearch";
import ReceiptCard from "@/components/receipts/ReceiptCard";
import ReceiptDetail from "@/components/receipts/ReceiptDetail";
import UploadModal from "@/components/receipts/UploadModal";

const PAGE_SIZE = 20;

export default function ReceiptsPage() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    queueMicrotask(() => setPage(0));
  }, [debouncedSearch]);

  const offset = page * PAGE_SIZE;
  const isSearchMode = debouncedSearch.trim().length > 0;

  const listQuery = useReceipts(PAGE_SIZE, offset);
  const searchQuery = useReceiptSearch(
    debouncedSearch.trim(),
    PAGE_SIZE,
    offset,
  );

  const active = isSearchMode ? searchQuery : listQuery;
  const { data, isLoading, isError } = active;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const canPrev = page > 0;
  const canNext = total > 0 && (page + 1) * PAGE_SIZE < total;

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <ReceiptSearch value={search} onChange={setSearch} />
        <Button
          type="button"
          className="shrink-0 sm:self-auto"
          onClick={() => setUploadOpen(true)}
        >
          <Upload className="size-4" />
          Upload Receipts
        </Button>
      </div>

      {isError && (
        <p className="text-sm text-destructive">
          Something went wrong while loading receipts.
        </p>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="space-y-3 rounded-xl border border-border/60 p-4"
            >
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-6 w-1/3" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <p className="text-muted-foreground">No receipts found</p>
          <Button
            type="button"
            className="mt-4"
            variant="secondary"
            onClick={() => setUploadOpen(true)}
          >
            <Upload className="size-4" />
            Upload receipts
          </Button>
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((receipt) => (
            <ReceiptCard
              key={receipt.receipt_id}
              receipt={receipt}
              selected={selectedId === receipt.receipt_id}
              onClick={() => setSelectedId(receipt.receipt_id)}
            />
          ))}
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 border-t pt-4 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canPrev}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canNext}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {selectedId != null && (
        <ReceiptDetail
          receiptId={selectedId}
          open={selectedId != null}
          onClose={() => setSelectedId(null)}
        />
      )}

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </motion.div>
  );
}
