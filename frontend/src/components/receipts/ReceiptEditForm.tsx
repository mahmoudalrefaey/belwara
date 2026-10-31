"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import type { ReceiptResponse, ReceiptUpdate } from "@/types/api";
import { useUpdateReceipt } from "@/hooks/useReceipts";
import { num } from "@/lib/format";
import { COMMON_CURRENCIES, isCurrency } from "@/lib/currencies";
import { CATEGORIES } from "@/lib/receiptStatus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ItemRow = { item_name: string; quantity: string; line_total: string };

const toNumber = (v: string) => (v.trim() === "" ? NaN : Number(v));

export default function ReceiptEditForm({
  receipt,
  onDone,
}: {
  receipt: ReceiptResponse;
  onDone: () => void;
}) {
  const t = useTranslations("receipts.edit");
  const tc = useTranslations("categories");
  const { mutateAsync, isPending } = useUpdateReceipt(receipt.receipt_id);
  const [merchant, setMerchant] = useState(receipt.merchant_name ?? "");
  const [date, setDate] = useState(receipt.receipt_date?.slice(0, 10) ?? "");
  const [total, setTotal] = useState(
    receipt.total_amount != null ? String(num(receipt.total_amount)) : "",
  );
  const [taxes, setTaxes] = useState(String(num(receipt.total_taxes)));
  const [currency, setCurrency] = useState(receipt.currency ?? "");
  const [category, setCategory] = useState(receipt.category ?? "");
  const [items, setItems] = useState<ItemRow[]>(
    receipt.items.map((i) => ({
      item_name: i.item_name,
      quantity: String(num(i.quantity)),
      line_total: String(num(i.line_total)),
    })),
  );
  const [error, setError] = useState<string | null>(null);

  const setItem = (index: number, patch: Partial<ItemRow>) =>
    setItems((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const itemsSum = items.reduce((n, r) => n + (toNumber(r.line_total) || 0), 0);

  const handleSave = async () => {
    const totalAmount = toNumber(total);
    if (!merchant.trim() || !date || Number.isNaN(totalAmount) || currency.trim().length < 3) {
      setError(t("required"));
      return;
    }
    if (!isCurrency(currency)) {
      setError(t("currencyInvalid"));
      return;
    }
    setError(null);
    const cleanItems = items
      .filter((r) => r.item_name.trim())
      .map((r) => {
        // A count or a weight (1.5 kg); up to three decimals, like the server.
        const typed = toNumber(r.quantity);
        const quantity = typed > 0 ? Math.round(typed * 1000) / 1000 : 1;
        const lineTotal = toNumber(r.line_total) || 0;
        return {
          item_name: r.item_name.trim(),
          quantity,
          unit_price: Math.round((lineTotal / quantity) * 100) / 100,
          line_total: lineTotal,
          taxes: 0,
        };
      });
    const patch: ReceiptUpdate = {
      merchant_name: merchant.trim(),
      receipt_date: `${date}T00:00:00Z`,
      total_amount: totalAmount,
      total_taxes: toNumber(taxes) || 0,
      currency: currency.trim().toUpperCase(),
      category: category || null,
      items: cleanItems,
    };
    try {
      await mutateAsync(patch);
      toast.success(t("saved"));
      onDone();
    } catch {
      setError(t("saveFailed"));
    }
  };

  return (
    <form
      className="space-y-5 rounded-2xl border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSave();
      }}
      noValidate
    >
      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="e-merchant">{t("merchant")} *</Label>
          <Input id="e-merchant" value={merchant} onChange={(e) => setMerchant(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e-date">{t("date")} *</Label>
          <Input id="e-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e-category">{t("category")}</Label>
          <select
            id="e-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-11 w-full cursor-pointer rounded-xl border border-input bg-card px-3 text-sm focus-visible:border-foreground focus-visible:ring-4 focus-visible:ring-lime/45 focus-visible:outline-none"
          >
            <option value="">{tc("uncategorized")}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {tc(c)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e-total">{t("total")} *</Label>
          <Input id="e-total" inputMode="decimal" dir="ltr" className="num" value={total} onChange={(e) => setTotal(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e-currency">{t("currency")} *</Label>
          <Input id="e-currency" list="e-currency-codes" maxLength={3} dir="ltr" placeholder="EGP" className="num uppercase" value={currency} onChange={(e) => setCurrency(e.target.value)} aria-invalid={currency.trim().length === 3 && !isCurrency(currency)} required />
          <datalist id="e-currency-codes">
            {COMMON_CURRENCIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e-taxes">{t("taxes")}</Label>
          <Input id="e-taxes" inputMode="decimal" dir="ltr" className="num" value={taxes} onChange={(e) => setTaxes(e.target.value)} />
        </div>
      </div>

      <fieldset className="space-y-2">
        <div className="flex items-center justify-between">
          <legend className="text-sm font-semibold">{t("items")}</legend>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setItems((rows) => [...rows, { item_name: "", quantity: "1", line_total: "" }])}
          >
            <Plus className="size-4" />
            {t("addItem")}
          </Button>
        </div>
        {items.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input aria-label={t("itemName")} placeholder={t("itemName")} value={row.item_name} onChange={(e) => setItem(i, { item_name: e.target.value })} />
            <Input aria-label={t("quantity")} className="num w-16 text-center" inputMode="decimal" dir="ltr" value={row.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} />
            <Input aria-label={t("lineTotal")} className="num w-28" inputMode="decimal" dir="ltr" placeholder="0.00" value={row.line_total} onChange={(e) => setItem(i, { line_total: e.target.value })} />
            <Button type="button" variant="ghost" size="icon-sm" aria-label={t("removeItem")} onClick={() => setItems((rows) => rows.filter((_, j) => j !== i))}>
              <X className="size-4" />
            </Button>
          </div>
        ))}
        {items.length > 0 && !Number.isNaN(toNumber(total)) && Math.abs(itemsSum - toNumber(total) + (toNumber(taxes) || 0)) > 0.01 && (
          <p className="text-xs text-muted-foreground">
            {t("sumHint", { sum: itemsSum.toFixed(2) })}
          </p>
        )}
      </fieldset>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {isPending ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}
