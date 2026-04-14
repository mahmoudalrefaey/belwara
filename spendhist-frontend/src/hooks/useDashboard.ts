"use client";

import { useMemo } from "react";
import { useAllReceipts } from "./useReceipts";
import { num } from "@/lib/format";
import { parseISO, format, startOfMonth } from "date-fns";
import type { ReceiptSummary } from "@/types/api";

interface StatCards {
  totalSpent: number;
  receiptCount: number;
  avgPerReceipt: number;
  thisMonth: number;
}

interface MonthlySpend {
  month: string;
  amount: number;
}

interface MerchantSpend {
  merchant: string;
  amount: number;
}

interface CurrencyBreakdown {
  currency: string;
  amount: number;
}

export function useDashboard() {
  const { data, isLoading, isError, error, refetch } = useAllReceipts();
  const receipts = data?.items ?? [];

  const stats = useMemo<StatCards>(() => {
    if (!receipts.length)
      return { totalSpent: 0, receiptCount: 0, avgPerReceipt: 0, thisMonth: 0 };

    const total = receipts.reduce((s, r) => s + num(r.total_amount), 0);
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const thisMonth = receipts
      .filter((r) => r.receipt_date?.startsWith(currentMonth))
      .reduce((s, r) => s + num(r.total_amount), 0);

    return {
      totalSpent: total,
      receiptCount: receipts.length,
      avgPerReceipt: receipts.length ? total / receipts.length : 0,
      thisMonth,
    };
  }, [receipts]);

  const monthlySpend = useMemo<MonthlySpend[]>(() => {
    const map = new Map<string, number>();
    receipts.forEach((r) => {
      try {
        const key = format(startOfMonth(parseISO(r.receipt_date)), "yyyy-MM");
        map.set(key, (map.get(key) ?? 0) + num(r.total_amount));
      } catch {
        /* skip bad dates */
      }
    });
    return Array.from(map.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [receipts]);

  const topMerchants = useMemo<MerchantSpend[]>(() => {
    const map = new Map<string, number>();
    receipts.forEach((r) => {
      const name = r.merchant_name || "Unknown";
      map.set(name, (map.get(name) ?? 0) + num(r.total_amount));
    });
    return Array.from(map.entries())
      .map(([merchant, amount]) => ({ merchant, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [receipts]);

  const currencyBreakdown = useMemo<CurrencyBreakdown[]>(() => {
    const map = new Map<string, number>();
    receipts.forEach((r) => {
      const cur = r.currency || "Other";
      map.set(cur, (map.get(cur) ?? 0) + num(r.total_amount));
    });
    return Array.from(map.entries())
      .map(([currency, amount]) => ({ currency, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [receipts]);

  const recentReceipts = useMemo<ReceiptSummary[]>(() => {
    return [...receipts]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 5);
  }, [receipts]);

  return {
    stats,
    monthlySpend,
    topMerchants,
    currencyBreakdown,
    recentReceipts,
    receipts,
    isLoading,
    isError,
    error,
    refetch,
  };
}
