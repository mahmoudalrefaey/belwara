"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertTriangle,
  ExternalLink,
  FileText,
  Loader2,
  Maximize2,
  Pencil,
  RotateCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  useDeleteReceipt,
  useReceipt,
  useReceiptImage,
  useReprocessReceipt,
} from "@/hooks/useReceipts";
import type { ReceiptResponse } from "@/types/api";
import ReceiptEditForm from "@/components/receipts/ReceiptEditForm";
import { Wara } from "@/components/illustrations/Wara";
import { Money } from "@/components/common/Money";
import { Stamp } from "@/components/common/Stamp";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFormat } from "@/lib/format";
import { isKnownCategory, isKnownReason } from "@/lib/receiptStatus";
import { num } from "@/lib/format";

/** The extracted data, typeset like the paper it came from. */
function PrintedReceipt({ data }: { data: ReceiptResponse }) {
  const t = useTranslations("receipts.detail");
  const tc = useTranslations("categories");
  const f = useFormat();
  const cur = data.currency;
  const row = (label: React.ReactNode, value: React.ReactNode, strong = false) => (
    <div className={strong ? "flex items-end gap-2 text-base font-semibold" : "flex items-end gap-2"}>
      <span className="min-w-0">{label}</span>
      <span className="leader" aria-hidden />
      <span className="shrink-0">{value}</span>
    </div>
  );

  return (
    <div className="drop-shadow-[0_10px_16px_rgb(10_10_11/0.14)]">
      <article className="edge-torn rounded-t-2xl bg-paper px-6 pb-10 pt-7 text-ink" aria-label={t("printedLabel")}>
        <header className="space-y-1 text-center">
          <p className="font-heading text-xl font-bold">{data.merchant_name?.trim() || t("unknownMerchant")}</p>
          <p className="num text-xs text-ink/60">
            {f.date(data.receipt_date)}
            {data.category && isKnownCategory(data.category) ? ` · ${tc(data.category)}` : ""}
          </p>
        </header>

        <div className="my-5 border-t-2 border-dashed border-ink/20" />

        {data.items?.length ? (
          <ul className="space-y-2.5 text-sm">
            {data.items.map((it) => (
              <li key={it.item_id}>
                {row(
                  <span>
                    {it.item_name}
                    {it.quantity > 1 && <span className="num text-ink/55"> ×{it.quantity}</span>}
                  </span>,
                  <span className="num">{f.money(it.line_total)}</span>,
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-sm text-ink/55">{t("noItems")}</p>
        )}

        <div className="my-5 border-t-2 border-dashed border-ink/20" />

        <div className="space-y-2 text-sm">
          {num(data.total_taxes) > 0 && row(t("taxes"), <span className="num">{f.money(data.total_taxes)}</span>)}
          {num(data.other) !== 0 && row(t("other"), <span className="num">{f.money(data.other)}</span>)}
          {row(t("total"), <Money amount={data.total_amount} currency={cur} className="text-lg" codeClassName="opacity-70" />, true)}
        </div>

        <p className="mt-6 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-ink/40">
          — {t("printedFooter")} —
        </p>
      </article>
    </div>
  );
}

export default function ReceiptDetail({
  receiptId,
  open,
  onClose,
}: {
  receiptId: number;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("receipts.detail");
  const tr = useTranslations("reasons");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const { data, isLoading, isError, refetch } = useReceipt(open ? receiptId : null);
  const image = useReceiptImage(receiptId, open && !!data?.has_image);
  const { mutateAsync: deleteReceipt, isPending: isDeleting } = useDeleteReceipt();
  const { mutateAsync: reprocess, isPending: isReprocessing } = useReprocessReceipt(receiptId);

  const handleDelete = async () => {
    try {
      await deleteReceipt(receiptId);
      toast.success(t("deleted"));
      setConfirmOpen(false);
      onClose();
    } catch {
      toast.error(t("deleteFailed"));
    }
  };

  const handleReprocess = async () => {
    try {
      await reprocess();
      toast.success(t("reprocessing"));
    } catch {
      toast.error(t("reprocessFailed"));
    }
  };

  const processing = data?.status === "processing";
  const failed = data?.status === "failed";
  const flagged = data?.status === "needs_review" || failed;
  const title = data?.merchant_name?.trim() || data?.source_filename || t("unknownMerchant");

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
        <SheetContent side="end" className="gap-0 p-0 sm:max-w-4xl">
          <SheetHeader className="border-b px-6 py-5 pe-16">
            <div className="flex flex-wrap items-center gap-3">
              <SheetTitle className="text-xl">{isLoading ? t("loading") : title}</SheetTitle>
              {data && <Stamp status={data.status} />}
            </div>
            <SheetDescription>{editing ? t("editing") : t("description")}</SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading && (
              <div className="grid gap-6 p-6 lg:grid-cols-2">
                <Skeleton className="h-96 rounded-2xl" />
                <Skeleton className="h-96 rounded-2xl" />
              </div>
            )}

            {isError && !isLoading && (
              <div className="p-6">
                <div className="flex flex-col items-center gap-3 text-center">
                  <Wara pose="crumpled" className="w-24 text-ink dark:text-bone" />
                  <p className="font-medium">{t("loadFailed")}</p>
                  <Button variant="outline" onClick={() => refetch()}>
                    {t("retry")}
                  </Button>
                </div>
              </div>
            )}

            {data && !isLoading && (
              <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                {/* Original */}
                <section aria-labelledby="orig-title" className="space-y-3 lg:sticky lg:top-0 lg:self-start">
                  <div className="flex items-center justify-between">
                    <h3 id="orig-title" className="text-sm font-semibold">{t("original")}</h3>
                    {image.url && !image.isPdf && (
                      <Button variant="ghost" size="sm" onClick={() => setZoomOpen(true)}>
                        <Maximize2 className="size-3.5" />
                        {t("zoom")}
                      </Button>
                    )}
                  </div>
                  <div className="overflow-hidden rounded-2xl border bg-muted/60">
                    {!data.has_image ? (
                      <p className="p-8 text-center text-sm text-muted-foreground">{t("noOriginal")}</p>
                    ) : image.isLoading ? (
                      <Skeleton className="h-80 rounded-none" />
                    ) : image.url && image.isPdf ? (
                      <a
                        href={image.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex flex-col items-center gap-2 p-10 text-sm font-medium hover:bg-muted"
                      >
                        <FileText className="size-8" aria-hidden />
                        <span className="inline-flex items-center gap-1">
                          {t("openPdf")} <ExternalLink className="size-3.5" aria-hidden />
                        </span>
                      </a>
                    ) : image.url ? (
                      <button type="button" onClick={() => setZoomOpen(true)} className="block w-full cursor-zoom-in" aria-label={t("zoom")}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- authenticated blob URL */}
                        <img src={image.url} alt={t("originalAlt", { name: title })} className="max-h-[70vh] w-full object-contain" />
                      </button>
                    ) : null}
                  </div>
                </section>

                {/* Extracted */}
                <section aria-labelledby="extracted-title" className="space-y-4">
                  <h3 id="extracted-title" className="sr-only">{t("extracted")}</h3>

                  {processing && (
                    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-8 text-center" aria-live="polite">
                      <Wara pose="reading" className="w-28 text-ink dark:text-bone" />
                      <p className="font-heading text-lg font-semibold">{t("processingTitle")}</p>
                      <p className="text-sm text-muted-foreground">{t("processingBody")}</p>
                    </div>
                  )}

                  {!processing && !failed && (
                    <div className="flex items-start gap-3 rounded-2xl bg-muted/70 p-4 text-sm">
                      <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-text" aria-hidden />
                      <p>
                        <span className="font-semibold">{t("aiNoticeTitle")}</span>{" "}
                        <span className="text-muted-foreground">{t("aiNoticeBody")}</span>
                      </p>
                    </div>
                  )}

                  {flagged && data.review_reasons?.length ? (
                    <div className="space-y-2 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm">
                      <p className="flex items-center gap-2 font-semibold text-foreground">
                        <AlertTriangle className="size-4 text-warning" aria-hidden />
                        {failed ? t("failedTitle") : t("reviewTitle")}
                      </p>
                      <ul className="space-y-1.5">
                        {data.review_reasons.map((r) => (
                          <li key={r} className="flex items-start gap-2 text-foreground/80">
                            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" aria-hidden />
                            {isKnownReason(r) ? tr(r) : r}
                          </li>
                        ))}
                      </ul>
                      {!failed && <p className="text-xs text-muted-foreground">{t("reviewHint")}</p>}
                    </div>
                  ) : null}

                  {failed && (
                    <div className="flex flex-col items-center gap-3 p-4 text-center">
                      <Wara pose="crumpled" className="w-24 text-ink dark:text-bone" />
                      <p className="text-sm text-muted-foreground">{t("failedBody")}</p>
                    </div>
                  )}

                  {editing ? (
                    <ReceiptEditForm receipt={data} onDone={() => setEditing(false)} />
                  ) : (
                    !processing && !failed && <PrintedReceipt data={data} />
                  )}
                </section>
              </div>
            )}
          </div>

          {data && !isLoading && !editing && (
            <SheetFooter className="flex-row flex-wrap items-center gap-2 border-t bg-muted/30 px-6 py-4">
              {!processing && (
                <Button variant={data.status === "needs_review" ? "default" : "outline"} onClick={() => setEditing(true)}>
                  <Pencil className="size-4" />
                  {data.status === "needs_review" ? t("fix") : t("edit")}
                </Button>
              )}
              {flagged && data.has_image && (
                <Button variant={failed ? "default" : "outline"} onClick={handleReprocess} disabled={isReprocessing}>
                  {isReprocessing ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
                  {t("reprocess")}
                </Button>
              )}
              <Button
                variant="ghost"
                className="ms-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmOpen(true)}
                disabled={isDeleting}
              >
                <Trash2 className="size-4" />
                {t("delete")}
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-h-[92dvh] overflow-auto p-2 sm:max-w-3xl">
          <DialogTitle className="sr-only">{t("original")}</DialogTitle>
          {image.url && (
            // eslint-disable-next-line @next/next/no-img-element -- authenticated blob URL
            <img src={image.url} alt={t("originalAlt", { name: title })} className="w-full rounded-2xl" />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmTitle")}</DialogTitle>
            <DialogDescription>{t("confirmBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={isDeleting}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="size-4 animate-spin" />}
              {t("confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
