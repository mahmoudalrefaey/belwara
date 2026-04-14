import {
  Calendar,
  DollarSign,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { money } from "@/lib/format";

export interface StatCardsProps {
  stats: {
    totalSpent: number;
    receiptCount: number;
    avgPerReceipt: number;
    thisMonth: number;
  };
}

const items = [
  {
    key: "totalSpent",
    label: "Total Spent",
    icon: DollarSign,
    format: (v: number) => money(v),
  },
  {
    key: "receiptCount",
    label: "Receipt Count",
    icon: Receipt,
    format: (v: number) => v.toLocaleString(),
  },
  {
    key: "avgPerReceipt",
    label: "Avg per Receipt",
    icon: TrendingUp,
    format: (v: number) => money(v),
  },
  {
    key: "thisMonth",
    label: "This Month",
    icon: Calendar,
    format: (v: number) => money(v),
  },
] as const;

export function StatCards({ stats }: StatCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ key, label, icon: Icon, format }) => (
        <Card key={key}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-muted-foreground text-sm font-medium">
                  {label}
                </p>
                <p className="text-2xl font-bold tracking-tight tabular-nums">
                  {format(stats[key])}
                </p>
              </div>
              <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
