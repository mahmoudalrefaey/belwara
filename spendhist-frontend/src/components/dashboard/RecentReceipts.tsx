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
import { Badge } from "@/components/ui/badge";
import { fmtDate, money } from "@/lib/format";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/receiptStatus";
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
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((r) => (
              <TableRow key={r.receipt_id}>
                <TableCell className="font-medium">
                  {r.merchant_name || r.source_filename || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {fmtDate(r.receipt_date)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {r.total_amount != null
                    ? money(r.total_amount, r.currency ?? undefined)
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[r.status]}>
                    {STATUS_LABEL[r.status]}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
