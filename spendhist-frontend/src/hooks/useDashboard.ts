"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDashboardData, useReceipts } from "./useReceipts";
import { getPrefs } from "@/lib/prefs";

/**
 * Dashboard numbers come from the server (computed in SQL, one currency at a time).
 * Starts with the preferred currency; the server falls back to the user's most-used one.
 */
export function useDashboard() {
  const [currency, setCurrency] = useState<string | null>(() => getPrefs().defaultCurrency);
  const dashboard = useDashboardData(currency);
  const recent = useReceipts(5, 0);
  const qc = useQueryClient();

  // When background extraction finishes, the totals change: refresh them.
  const processing = recent.data?.items.filter((r) => r.status === "processing").length ?? 0;
  const lastProcessing = useRef(processing);
  useEffect(() => {
    if (processing < lastProcessing.current) {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    }
    lastProcessing.current = processing;
  }, [processing, qc]);

  return {
    data: dashboard.data,
    currency: dashboard.data?.currency ?? null,
    setCurrency,
    recentReceipts: recent.data?.items ?? [],
    isLoading: dashboard.isLoading,
    isError: dashboard.isError,
    error: dashboard.error,
    refetch: dashboard.refetch,
  };
}
