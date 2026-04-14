import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtDate, money, num } from "@/lib/format";
import type { ReceiptSummary } from "@/types/api";

export interface RecentReceiptsProps {
  data: ReceiptSummary[];
}

export function RecentReceipts({ data }: RecentReceiptsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Receipts</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Merchant</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Currency</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((r) => (
              <TableRow key={r.receipt_id}>
                <TableCell className="font-medium">
                  {r.merchant_name || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {fmtDate(r.receipt_date)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {money(num(r.total_amount))}
                </TableCell>
                <TableCell>{r.currency || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
