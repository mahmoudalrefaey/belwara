"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, MessageSquarePlus, X } from "lucide-react";
import type { ChatError } from "@/hooks/useChat";
import { useChatThreads } from "@/hooks/useChat";
import { Link } from "@/i18n/navigation";
import { Wara } from "@/components/illustrations/Wara";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useFormat } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Honest wait: no fake typing, just what is actually happening. */
export function Thinking() {
  const t = useTranslations("chat.thinking");
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSlow(true), 6000);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <div className="flex items-center gap-3" role="status" aria-live="polite">
      <Wara pose="reading" className="w-12 shrink-0 text-ink dark:text-bone" />
      <div className="rounded-3xl rounded-ss-md border border-border/70 bg-card px-4 py-3 shadow-paper">
        <p className="shimmer-text font-medium">{t("searching")}</p>
        {slow && <p className="mt-1 text-xs text-muted-foreground">{t("slow")}</p>}
      </div>
    </div>
  );
}

export function ChatErrorCard({ error, onDismiss }: { error: ChatError; onDismiss: () => void }) {
  const t = useTranslations("chat.errors");
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      <div className="flex-1 space-y-1">
        <p className="font-medium text-foreground">{t(`${error.kind}.title`)}</p>
        <p className="text-muted-foreground">{error.kind === "quota" && error.detail ? error.detail : t(`${error.kind}.body`)}</p>
        {error.kind === "quota" && (
          <Link href="/profile#usage" className="inline-block font-medium text-foreground underline underline-offset-4">
            {t("quota.action")}
          </Link>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("dismiss")}
        className="grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function ThreadList({
  activeId,
  onOpen,
  onNew,
  className,
}: {
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  className?: string;
}) {
  const t = useTranslations("chat.threads");
  const f = useFormat();
  const { data, isLoading, isError } = useChatThreads();

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <Button variant="ink" className="mb-4 w-full" onClick={onNew}>
        <MessageSquarePlus className="size-4" />
        {t("new")}
      </Button>
      <p className="mb-2 px-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t("title")}</p>
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : isError ? (
          <p className="px-2 text-sm text-muted-foreground">{t("error")}</p>
        ) : !data?.length ? (
          <p className="px-2 text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="space-y-1">
            {data.map((th) => {
              const active = th.thread_id === activeId;
              return (
                <li key={th.thread_id}>
                  <button
                    type="button"
                    onClick={() => onOpen(th.thread_id)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "w-full cursor-pointer rounded-2xl px-3 py-2.5 text-start transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                      active ? "bg-lime text-ink" : "hover:bg-muted",
                    )}
                  >
                    <p className="line-clamp-1 text-sm font-medium">{th.title || t("untitled")}</p>
                    <p className={cn("text-xs", active ? "text-ink/60" : "text-muted-foreground")}>
                      {f.relative(th.last_message_at)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
