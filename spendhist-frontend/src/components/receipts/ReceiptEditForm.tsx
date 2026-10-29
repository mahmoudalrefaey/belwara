"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import type { ReceiptResponse, ReceiptUpdate } from "@/types/api";
import { useUpdateReceipt } from "@/hooks/useReceipts";
import { num } from "@/lib/format";
import { CATEGORIES, categoryLabel } from "@/lib/receiptStatus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ItemRow = { item_name: string; quantity: string; line_total: string };

type ReceiptEditFormProps = {
  receipt: ReceiptResponse;
  onDone: () => void;
};

const toNumber = (v: string) => (v.trim() === "" ? NaN : Number(v));

export default function ReceiptEditForm({ receipt, onDone }: ReceiptEditFormProps) {
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
      quantity: String(i.quantity),
      line_total: String(num(i.line_total)),
    })),
  );

  const setItem = (index: number, patch: Partial<ItemRow>) =>
    setItems((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const handleSave = async () => {
    const totalAmount = toNumber(total);
    if (!merchant.trim() || !date || Number.isNaN(totalAmount) || currency.trim().length < 3) {
      toast.error("Merchant, date, total and currency are required.");
      return;
    }
    const cleanItems = items
      .filter((r) => r.item_name.trim())
      .map((r) => {
        const quantity = Math.max(1, Math.round(toNumber(r.quantity) || 1));
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
      toast.success("Receipt saved");
      onDone();
    } catch {
      toast.error("Could not save the receipt. Check the values and try again.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="merchant">Merchant</Label>
          <Input id="merchant" value={merchant} onChange={(e) => setMerchant(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="">Uncategorized</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="total">Total</Label>
          <Input
            id="total"
            inputMode="decimal"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currency">Currency</Label>
          <Input
            id="currency"
            maxLength={10}
            placeholder="EGP"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="taxes">Taxes</Label>
          <Input
            id="taxes"
            inputMode="decimal"
            value={taxes}
            onChange={(e) => setTaxes(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Line items</h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setItems((rows) => [...rows, { item_name: "", quantity: "1", line_total: "" }])
            }
          >
            <Plus className="size-4" />
            Add item
          </Button>
        </div>
        {items.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              aria-label="Item name"
              placeholder="Item"
              value={row.item_name}
              onChange={(e) => setItem(i, { item_name: e.target.value })}
            />
            <Input
              aria-label="Quantity"
              className="w-14"
              inputMode="numeric"
              value={row.quantity}
              onChange={(e) => setItem(i, { quantity: e.target.value })}
            />
            <Input
              aria-label="Line total"
              className="w-24"
              inputMode="decimal"
              placeholder="Total"
              value={row.line_total}
              onChange={(e) => setItem(i, { line_total: e.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Remove item"
              onClick={() => setItems((rows) => rows.filter((_, j) => j !== i))}
            >
              <X className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
