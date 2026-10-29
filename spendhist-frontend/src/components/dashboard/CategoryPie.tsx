"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { money } from "@/lib/format";

const COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#0ea5e9", "#8b5cf6", "#14b8a6", "#64748b",
];

export interface CategoryPieProps {
  data: { category: string; amount: number }[];
  currency?: string;
}

export function CategoryPie({ data, currency }: CategoryPieProps) {
  return (
    <Card className="h-full min-h-[280px]">
      <CardHeader>
        <CardTitle>By Category</CardTitle>
      </CardHeader>
      <CardContent className="min-h-[220px] flex-1 pb-2">
        {data.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            No category data
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={data}
                dataKey="amount"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
              >
                {data.map((_, i) => (
                  <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                }}
                formatter={(value, name) => [
                  money(Number(value ?? 0), currency),
                  String(name ?? ""),
                ]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
