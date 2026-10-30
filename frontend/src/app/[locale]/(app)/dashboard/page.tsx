"use client";

import { useTranslations } from "next-intl";
import { RotateCw } from "lucide-react";
import { useDashboard } from "@/hooks/useDashboard";
import { useAuth } from "@/providers/AuthProvider";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { MonthHero } from "@/components/dashboard/MonthHero";
import { Insights } from "@/components/dashboard/Insights";
import { AskChips } from "@/components/dashboard/AskChips";
import { MonthlyChart } from "@/components/dashboard/MonthlyChart";
import { CategoryBreakdown, MerchantBreakdown } from "@/components/dashboard/Breakdown";
import { FirstRun, RecentReceipts, ReviewBanner } from "@/components/dashboard/Panels";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFormat } from "@/lib/format";

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-12">
        <Skeleton className="h-72 rounded-3xl lg:col-span-7" />
        <Skeleton className="h-72 rounded-3xl lg:col-span-5" />
      </div>
      <Skeleton className="h-80 rounded-3xl" />
    </div>
  );
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const f = useFormat();
  const { user } = useAuth();
  const { data, setCurrency, recentReceipts, isLoading, isError, refetch } = useDashboard();
  const firstName = user?.full_name?.trim().split(/\s+/)[0];

  if (isLoading) return <DashboardSkeleton />;

  if (isError || !data) {
    return (
      <EmptyState
        pose="crumpled"
        title={t("error.title")}
        description={t("error.body")}
        action={
          <Button onClick={() => refetch()}>
            <RotateCw className="size-4" />
            {t("error.retry")}
          </Button>
        }
      />
    );
  }

  const header = (
    <PageHeader
      eyebrow={f.date(new Date().toISOString())}
      title={firstName ? t("greetingNamed", { name: firstName }) : t("greeting")}
      description={t("subtitle")}
    />
  );

  // Nothing uploaded yet: show the path, not empty charts.
  if (data.receipts === 0 && recentReceipts.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <FirstRun name={firstName} />
      </div>
    );
  }

  // Uploads exist but none are counted yet (still reading or needing review).
  if (data.receipts === 0) {
    return (
      <div className="space-y-6">
        {header}
        {data.needs_review > 0 && <ReviewBanner count={data.needs_review} />}
        <div className="rounded-3xl border border-border/70 bg-card shadow-paper">
          <EmptyState pose="reading" title={t("waiting.title")} description={t("waiting.body")} />
        </div>
        <RecentReceipts items={recentReceipts} />
      </div>
    );
  }

  const cur = data.currency;
  return (
    <div className="space-y-6">
      {header}
      {data.needs_review > 0 && <ReviewBanner count={data.needs_review} />}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <MonthHero data={data} onCurrency={setCurrency} />
        </div>
        <div className="lg:col-span-5">
          <Insights data={data} />
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <MonthlyChart data={data.by_month} currency={cur} />
        </div>
        <div className="lg:col-span-4">
          <AskChips />
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <CategoryBreakdown data={data.by_category} currency={cur} />
        <MerchantBreakdown data={data.by_merchant} currency={cur} />
      </div>

      {recentReceipts.length > 0 && <RecentReceipts items={recentReceipts} />}
    </div>
  );
}
