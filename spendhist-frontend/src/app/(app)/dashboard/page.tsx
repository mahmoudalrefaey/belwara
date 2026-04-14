"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Receipt, Upload } from "lucide-react";
import { CurrencyPie } from "@/components/dashboard/CurrencyPie";
import { MerchantBar } from "@/components/dashboard/MerchantBar";
import { RecentReceipts } from "@/components/dashboard/RecentReceipts";
import { SpendingChart } from "@/components/dashboard/SpendingChart";
import { StatCards } from "@/components/dashboard/StatCards";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/hooks/useDashboard";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const {
    stats,
    monthlySpend,
    topMerchants,
    currencyBreakdown,
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

  if (stats.receiptCount === 0) {
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

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">
        Dashboard
      </h1>
      <motion.div
        className="space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
      >
        <StatCards stats={stats} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SpendingChart data={monthlySpend} />
          </div>
          <div className="flex flex-col gap-6">
            <MerchantBar data={topMerchants} />
            <CurrencyPie data={currencyBreakdown} />
          </div>
        </div>
        <RecentReceipts data={recentReceipts} />
      </motion.div>
    </div>
  );
}
