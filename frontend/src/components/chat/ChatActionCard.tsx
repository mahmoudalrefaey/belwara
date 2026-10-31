"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Tag, Trash2, X } from "lucide-react";
import type { ChatAction } from "@/types/api";
import { api } from "@/lib/api";
import { invalidateReceipts } from "@/hooks/useReceipts";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/common/Money";
import { useFormat } from "@/lib/format";
import { cn } from "@/lib/utils";

const ICONS = { set_category: Tag, mark_reviewed: Check, delete_receipt: Trash2 } as const;

/** Error responses from confirm/cancel carry the action's real status (stale, expired…). */
function statusFrom(err: unknown): string | null {
  const detail = (err as { response?: { data?: { detail?: { status?: string } } } })?.response?.data?.detail;
  return detail?.status ?? null;
}

/**
 * A change Wara'a prepared. Nothing happens until the user taps Confirm; what the card says after
 * that comes from the server's answer, never from the chat reply.
 */
export function ChatActionCard({ action: initial }: { action: ChatAction }) {
  const t = useTranslations("chat.actions");
  const tc = useTranslations("categories");
  const f = useFormat();
  const qc = useQueryClient();
  const [action, setAction] = useState(initial);

  const resolve = useMutation({
    mutationFn: async (verb: "confirm" | "cancel") => {
      const { data } = await api.post<ChatAction>(`/chat/actions/${action.action_id}/${verb}`);
      return data;
    },
    onSuccess: (data) => {
      setAction(data);
      if (data.status === "done") invalidateReceipts(qc, data.receipt_id);
    },
    onError: (err) => {
      const status = statusFrom(err);
      setAction((a) => ({ ...a, status: status ?? "failed" }));
    },
  });

  const Icon = ICONS[action.kind];
  const s = action.summary ?? {};
  const what =
    action.kind === "set_category"
      ? t("setCategory", { category: tc(action.payload?.category ?? "other") })
      : t(action.kind === "mark_reviewed" ? "markReviewed" : "delete");
  const pending = action.status === "pending";

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-3.5 text-sm shadow-paper",
        pending ? "border-ink/25" : "border-border/70",
      )}
      role="group"
      aria-label={what}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-full bg-lime/30 p-1.5 text-ink dark:text-bone">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="font-medium">{what}</p>
          <p className="truncate text-muted-foreground">
            {s.merchant || t("unknownMerchant")}
            {s.date ? ` · ${f.date(s.date)}` : ""}
            {s.total ? (
              <>
                {" · "}
                <Money amount={s.total} currency={s.currency} />
              </>
            ) : null}
          </p>
        </div>
      </div>
      {pending ? (
        <div className="mt-3 flex items-center gap-2">
          <Button
            size="sm"
            variant={action.kind === "delete_receipt" ? "destructive" : "default"}
            disabled={resolve.isPending}
            onClick={() => resolve.mutate("confirm")}
          >
            {resolve.isPending && resolve.variables === "confirm" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            {t("confirm")}
          </Button>
          <Button size="sm" variant="ghost" disabled={resolve.isPending} onClick={() => resolve.mutate("cancel")}>
            <X className="size-4" aria-hidden />
            {t("cancel")}
          </Button>
          <span className="ms-auto text-xs text-muted-foreground">{t("nothingYet")}</span>
        </div>
      ) : (
        <p
          className={cn("mt-2 text-xs font-medium", action.status === "done" ? "text-foreground" : "text-muted-foreground")}
          role="status"
        >
          {t(`status.${action.status}`)}
        </p>
      )}
    </div>
  );
}
