"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, Receipt, Upload } from "lucide-react";
import { CategoryPie } from "@/components/dashboard/CategoryPie";
import { MerchantBar } from "@/components/dashboard/MerchantBar";
import { RecentReceipts } from "@/components/dashboard/RecentReceipts";
import { SpendingChart } from "@/components/dashboard/SpendingChart";
import { StatCards } from "@/components/dashboard/StatCards";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/hooks/useDashboard";
import { categoryLabel } from "@/lib/receiptStatus";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const {
    data,
    currency,
    setCurrency,
    recentReceipts,
    isLoading,
    isError,
    error,
    refetch,
  } = useDashboard();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 pt-6">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Dashboard
        </h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-destructive max-w-md text-sm">
              {error?.message ?? "Something went wrong while loading your dashboard."}
            </p>
            <Button type="button" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data || (data.receipts === 0 && recentReceipts.length === 0)) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Dashboard
        </h1>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          <Card>
            <CardContent className="flex flex-col items-center gap-6 py-16 text-center">
              <div className="bg-muted text-muted-foreground flex h-28 w-28 items-center justify-center rounded-2xl">
                <Receipt className="h-14 w-14 stroke-[1.25]" aria-hidden />
              </div>
              <div className="max-w-sm space-y-2">
                <p className="text-lg font-medium">No receipts yet</p>
                <p className="text-muted-foreground text-sm">
                  Upload a receipt to see spending trends, merchants, and summaries here.
                </p>
              </div>
              <Link
                href="/receipts"
                className={cn(buttonVariants({ variant: "default" }))}
              >
                <Upload className="size-4" />
                Go to receipts
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const cur = currency ?? undefined;
  const stats = {
    totalSpent: data.total,
    receiptCount: data.receipts,
    avgPerReceipt: data.average,
    thisMonth: data.this_month,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Dashboard
        </h1>
        {data.currencies.length > 1 && (
          <div className="flex flex-wrap gap-1" role="group" aria-label="Currency">
            {data.currencies.map((c) => (
              <Button
                key={c.currency}
                type="button"
                size="sm"
                variant={c.currency === currency ? "default" : "outline"}
                aria-pressed={c.currency === currency}
                onClick={() => setCurrency(c.currency)}
              >
                {c.currency}
              </Button>
            ))}
          </div>
        )}
      </div>
      {data.needs_review > 0 && (
        <Link
          href="/receipts"
          className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm hover:bg-amber-500/15"
        >
          <AlertTriangle className="size-4 shrink-0" />
          {data.needs_review === 1
            ? "1 receipt needs your review."
            : `${data.needs_review} receipts need your review.`}
          <span className="ml-auto font-medium">Review</span>
        </Link>
      )}
      <motion.div
        className="space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
      >
        <StatCards stats={stats} currency={cur} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SpendingChart
              currency={cur}
              data={data.by_month.map((r) => ({ month: r.label, amount: r.total }))}
            />
          </div>
          <div className="flex flex-col gap-6">
            <MerchantBar
              currency={cur}
              data={data.by_merchant.map((r) => ({ merchant: r.label, amount: r.total }))}
            />
            <CategoryPie
              currency={cur}
              data={data.by_category.map((r) => ({
                category: categoryLabel(r.label === "Unknown" ? null : r.label),
                amount: r.total,
              }))}
            />
          </div>
        </div>
        <RecentReceipts data={recentReceipts} />
      </motion.div>
    </div>
  );
}
