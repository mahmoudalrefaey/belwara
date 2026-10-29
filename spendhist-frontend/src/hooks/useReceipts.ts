"use client";

import { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  DashboardResponse,
  PaginatedReceiptsResponse,
  ReceiptResponse,
  ReceiptSearchResponse,
  ReceiptSummary,
  ReceiptUpdate,
  UploadResponse,
  DeleteReceiptResponse,
} from "@/types/api";

const POLL_MS = 3000;

const anyProcessing = (items?: ReceiptSummary[]) =>
  !!items?.some((r) => r.status === "processing");

export function useReceipts(limit = 20, offset = 0) {
  return useQuery<PaginatedReceiptsResponse>({
    queryKey: ["receipts", { limit, offset }],
    queryFn: async () => {
      const { data } = await api.get("/receipts", {
        params: { limit, offset },
      });
      return data;
    },
    staleTime: 60_000,
    // Keep polling while uploads are being extracted in the background.
    refetchInterval: (query) =>
      anyProcessing(query.state.data?.items) ? POLL_MS : false,
  });
}

export function useReceipt(receiptId: number | null) {
  return useQuery<ReceiptResponse>({
    queryKey: ["receipt", receiptId],
    queryFn: async () => {
      const { data } = await api.get(`/receipts/${receiptId}`);
      return data;
    },
    enabled: !!receiptId,
    staleTime: 300_000,
    refetchInterval: (query) =>
      query.state.data?.status === "processing" ? POLL_MS : false,
  });
}

/** Object URL for the original upload (fetched with the auth header). */
export function useReceiptImage(receiptId: number | null, enabled: boolean) {
  const { data: blob } = useQuery<Blob>({
    queryKey: ["receipt-image", receiptId],
    queryFn: async () => {
      const { data } = await api.get(`/receipts/${receiptId}/image`, {
        responseType: "blob",
      });
      return data;
    },
    enabled: !!receiptId && enabled,
    staleTime: Infinity,
  });
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);
  return { url, isPdf: blob?.type === "application/pdf" };
}

export function useReceiptSearch(q: string, limit = 50, offset = 0) {
  return useQuery<ReceiptSearchResponse>({
    queryKey: ["receipts-search", { q, limit, offset }],
    queryFn: async () => {
      const { data } = await api.get("/receipts/search", {
        params: { q, limit, offset, include_raw: true },
      });
      return data;
    },
    enabled: q.trim().length > 0,
    staleTime: 30_000,
  });
}

export function useDashboardData(currency: string | null) {
  return useQuery<DashboardResponse>({
    queryKey: ["dashboard", currency],
    queryFn: async () => {
      const { data } = await api.get("/receipts/dashboard", {
        params: currency ? { currency } : {},
      });
      return data;
    },
    staleTime: 30_000,
  });
}

function invalidateReceipts(qc: ReturnType<typeof useQueryClient>, receiptId?: number) {
  qc.invalidateQueries({ queryKey: ["receipts"] });
  qc.invalidateQueries({ queryKey: ["receipts-search"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
  if (receiptId != null) qc.invalidateQueries({ queryKey: ["receipt", receiptId] });
}

export function useUploadReceipts() {
  const qc = useQueryClient();
  return useMutation<UploadResponse, Error, File[]>({
    mutationFn: async (files) => {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      const { data } = await api.post("/receipts/upload", form);
      return data;
    },
    onSuccess: () => invalidateReceipts(qc),
  });
}

export function useUpdateReceipt(receiptId: number) {
  const qc = useQueryClient();
  return useMutation<ReceiptResponse, Error, ReceiptUpdate>({
    mutationFn: async (patch) => {
      const { data } = await api.patch(`/receipts/${receiptId}`, patch);
      return data;
    },
    onSuccess: () => invalidateReceipts(qc, receiptId),
  });
}

export function useReprocessReceipt(receiptId: number) {
  const qc = useQueryClient();
  return useMutation<ReceiptSummary, Error, void>({
    mutationFn: async () => {
      const { data } = await api.post(`/receipts/${receiptId}/reprocess`);
      return data;
    },
    onSuccess: () => invalidateReceipts(qc, receiptId),
  });
}

export function useDeleteReceipt() {
  const qc = useQueryClient();
  return useMutation<DeleteReceiptResponse, Error, number>({
    mutationFn: async (receiptId) => {
      const { data } = await api.delete(`/receipts/${receiptId}`);
      return data;
    },
    onSuccess: (_data, receiptId) => invalidateReceipts(qc, receiptId),
  });
}
