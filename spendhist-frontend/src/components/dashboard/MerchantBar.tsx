"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { money } from "@/lib/format";

export interface MerchantBarProps {
  data: { merchant: string; amount: number }[];
}

export function MerchantBar({ data }: MerchantBarProps) {
  const top5 = data.slice(0, 5);

  return (
    <Card className="h-full min-h-[280px]">
      <CardHeader>
        <CardTitle>Top Merchants</CardTitle>
      </CardHeader>
      <CardContent className="min-h-[220px] flex-1 pb-2">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            layout="vertical"
            data={top5}
            margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => money(Number(v))}
            />
            <YAxis
              type="category"
              dataKey="merchant"
              width={100}
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) =>
                String(v).length > 14 ? `${String(v).slice(0, 14)}…` : String(v)
              }
            />
            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--card)",
              }}
              formatter={(value) => [money(Number(value ?? 0)), "Spend"]}
            />
            <Bar dataKey="amount" fill="#6366f1" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
