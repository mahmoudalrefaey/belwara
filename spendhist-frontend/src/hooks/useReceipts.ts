"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  PaginatedReceiptsResponse,
  ReceiptResponse,
  ReceiptSearchResponse,
  UploadResponse,
  DeleteReceiptResponse,
} from "@/types/api";

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
  });
}

export function useAllReceipts() {
  return useQuery<PaginatedReceiptsResponse>({
    queryKey: ["receipts", { limit: 200, offset: 0 }],
    queryFn: async () => {
      const { data } = await api.get("/receipts", {
        params: { limit: 100, offset: 0 },
      });
      return data;
    },
    staleTime: 60_000,
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
  });
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

export function useUploadReceipts() {
  const qc = useQueryClient();
  return useMutation<UploadResponse, Error, File[]>({
    mutationFn: async (files) => {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      const { data } = await api.post("/receipts/upload", form);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["receipts"] });
      qc.invalidateQueries({ queryKey: ["receipts-search"] });
    },
  });
}

export function useDeleteReceipt() {
  const qc = useQueryClient();
  return useMutation<DeleteReceiptResponse, Error, number>({
    mutationFn: async (receiptId) => {
      const { data } = await api.delete(`/receipts/${receiptId}`);
      return data;
    },
    onSuccess: (_data, receiptId) => {
      qc.invalidateQueries({ queryKey: ["receipts"] });
      qc.invalidateQueries({ queryKey: ["receipts-search"] });
      qc.invalidateQueries({ queryKey: ["receipt", receiptId] });
    },
  });
}
