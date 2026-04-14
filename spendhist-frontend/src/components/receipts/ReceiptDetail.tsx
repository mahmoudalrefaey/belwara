"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { ReceiptItemResponse } from "@/types/api";
import { useReceipt, useDeleteReceipt } from "@/hooks/useReceipts";
import { money, fmtDate } from "@/lib/format";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

type ReceiptDetailProps = {
  receiptId: number;
  open: boolean;
  onClose: () => void;
};

export default function ReceiptDetail({
  receiptId,
  open,
  onClose,
}: ReceiptDetailProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { data, isLoading, isError } = useReceipt(open ? receiptId : null);
  const { mutateAsync: deleteReceipt, isPending: isDeleting } =
    useDeleteReceipt();

  const handleDelete = async () => {
    try {
      await deleteReceipt(receiptId);
      toast.success("Receipt deleted");
      setConfirmOpen(false);
      onClose();
    } catch {
      toast.error("Could not delete receipt. Try again.");
    }
  };

  const merchant =
    data?.merchant_name?.trim() || "Unknown Merchant";

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <SheetContent
          side="right"
          className="w-full gap-0 p-0 sm:max-w-[420px]"
        >
          <SheetHeader className="border-b px-4 py-4">
            <SheetTitle className="pr-8">{merchant}</SheetTitle>
            <SheetDescription>
              Receipt details and line items
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col overflow-hidden">
            {isLoading && (
              <div className="space-y-4 p-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            )}

            {isError && !isLoading && (
              <p className="p-4 text-sm text-destructive">
                Failed to load receipt.
              </p>
            )}

            {data && !isLoading && (
              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-4 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{data.currency}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {fmtDate(data.receipt_date)}
                    </span>
                  </div>

                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-muted-foreground">Total</dt>
                      <dd className="font-medium">
                        {money(data.total_amount, data.currency)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Taxes</dt>
                      <dd className="font-medium">
                        {money(data.total_taxes, data.currency)}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">Other</dt>
                      <dd className="font-medium">
                        {money(data.other, data.currency)}
                      </dd>
                    </div>
                  </dl>

                  <div>
                    <h3 className="mb-2 text-sm font-medium">Line items</h3>
                    <div className="rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">
                              Unit Price
                            </TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Tax</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.items?.length ? (
                            data.items.map((row: ReceiptItemResponse) => (
                              <TableRow key={row.item_id}>
                                <TableCell className="max-w-[140px] whitespace-normal">
                                  {row.item_name}
                                </TableCell>
                                <TableCell className="text-right">
                                  {row.quantity}
                                </TableCell>
                                <TableCell className="text-right">
                                  {money(row.unit_price, data.currency)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {money(row.line_total, data.currency)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {money(row.taxes, data.currency)}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className="text-center text-muted-foreground"
                              >
                                No line items
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            )}
          </div>

          {data && !isLoading && (
            <SheetFooter className="border-t bg-muted/30">
              <Button
                type="button"
                variant="destructive"
                className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
                onClick={() => setConfirmOpen(true)}
                disabled={isDeleting}
              >
                <Trash2 className="size-4" />
                Delete receipt
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this receipt?</DialogTitle>
            <DialogDescription>
              This removes the receipt and its line items. You cannot undo
              this action.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
