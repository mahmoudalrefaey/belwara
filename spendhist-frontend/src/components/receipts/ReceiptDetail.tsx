"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Pencil, RotateCw, Trash2 } from "lucide-react";
import type { ReceiptItemResponse } from "@/types/api";
import {
  useReceipt,
  useDeleteReceipt,
  useReceiptImage,
  useReprocessReceipt,
} from "@/hooks/useReceipts";
import { money, fmtDate } from "@/lib/format";
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  categoryLabel,
  reasonLabel,
} from "@/lib/receiptStatus";
import ReceiptEditForm from "@/components/receipts/ReceiptEditForm";
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
  const [editing, setEditing] = useState(false);
  const { data, isLoading, isError } = useReceipt(open ? receiptId : null);
  const image = useReceiptImage(receiptId, open && !!data?.has_image);
  const { mutateAsync: deleteReceipt, isPending: isDeleting } =
    useDeleteReceipt();
  const { mutateAsync: reprocess, isPending: isReprocessing } =
    useReprocessReceipt(receiptId);

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

  const handleReprocess = async () => {
    try {
      await reprocess();
      toast.success("Reading the receipt again…");
    } catch {
      toast.error("Could not reprocess this receipt.");
    }
  };

  const processing = data?.status === "processing";
  const flagged = data?.status === "needs_review" || data?.status === "failed";
  const currency = data?.currency ?? undefined;
  const merchant =
    data?.merchant_name?.trim() || data?.source_filename || "Unknown Merchant";

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
          className="w-full gap-0 p-0 sm:max-w-[480px]"
        >
          <SheetHeader className="border-b px-4 py-4">
            <SheetTitle className="pr-8">{merchant}</SheetTitle>
            <SheetDescription>
              {editing ? "Correct the details below" : "Receipt details and line items"}
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
                    <Badge variant={STATUS_VARIANT[data.status]}>
                      {processing && <Loader2 className="animate-spin" />}
                      {STATUS_LABEL[data.status]}
                    </Badge>
                    {data.currency && <Badge variant="secondary">{data.currency}</Badge>}
                    {data.category && (
                      <Badge variant="outline">{categoryLabel(data.category)}</Badge>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {fmtDate(data.receipt_date)}
                    </span>
                  </div>

                  {flagged && data.review_reasons?.length ? (
                    <div className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                      <p className="flex items-center gap-2 font-medium">
                        <AlertTriangle className="size-4" />
                        {data.status === "failed"
                          ? "We couldn't read this receipt"
                          : "Please check these details"}
                      </p>
                      <ul className="list-disc pl-6 text-muted-foreground">
                        {data.review_reasons.map((r) => (
                          <li key={r}>{reasonLabel(r)}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {processing && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Reading your receipt. This usually takes a few seconds.
                    </p>
                  )}

                  {image.url &&
                    (image.isPdf ? (
                      <a
                        href={image.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-primary underline-offset-4 hover:underline"
                      >
                        Open original PDF
                      </a>
                    ) : (
                      <a href={image.url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element -- blob URL */}
                        <img
                          src={image.url}
                          alt="Original receipt"
                          className="max-h-72 w-full rounded-lg border object-contain"
                        />
                      </a>
                    ))}

                  {editing ? (
                    <ReceiptEditForm receipt={data} onDone={() => setEditing(false)} />
                  ) : (
                    !processing && (
                      <>
                        <dl className="grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <dt className="text-muted-foreground">Total</dt>
                            <dd className="font-medium">
                              {data.total_amount != null
                                ? money(data.total_amount, currency)
                                : "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Taxes</dt>
                            <dd className="font-medium">
                              {money(data.total_taxes, currency)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Other</dt>
                            <dd className="font-medium">{money(data.other, currency)}</dd>
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
                                  <TableHead className="text-right">Unit Price</TableHead>
                                  <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {data.items?.length ? (
                                  data.items.map((row: ReceiptItemResponse) => (
                                    <TableRow key={row.item_id}>
                                      <TableCell className="max-w-[160px] whitespace-normal">
                                        {row.item_name}
                                      </TableCell>
                                      <TableCell className="text-right">{row.quantity}</TableCell>
                                      <TableCell className="text-right">
                                        {money(row.unit_price, currency)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {money(row.line_total, currency)}
                                      </TableCell>
                                    </TableRow>
                                  ))
                                ) : (
                                  <TableRow>
                                    <TableCell
                                      colSpan={4}
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
                      </>
                    )
                  )}
                </div>
              </ScrollArea>
            )}
          </div>

          {data && !isLoading && !editing && (
            <SheetFooter className="flex-row flex-wrap gap-2 border-t bg-muted/30">
              {!processing && (
                <Button type="button" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="size-4" />
                  Edit
                </Button>
              )}
              {flagged && data.has_image && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReprocess}
                  disabled={isReprocessing}
                >
                  <RotateCw className="size-4" />
                  Reprocess
                </Button>
              )}
              <Button
                type="button"
                variant="destructive"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => setConfirmOpen(true)}
                disabled={isDeleting}
              >
                <Trash2 className="size-4" />
                Delete
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
              This removes the receipt, its line items and the original file. You
              cannot undo this action.
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
