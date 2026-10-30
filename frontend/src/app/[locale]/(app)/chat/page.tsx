"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { History, MessageSquarePlus, ShieldCheck } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput, type ChatInputHandle } from "@/components/chat/ChatInput";
import { ChatErrorCard, Thinking, ThreadList } from "@/components/chat/ChatParts";
import { Wara } from "@/components/illustrations/Wara";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const SUGGESTIONS = ["thisMonth", "topCategory", "biggest", "compare"] as const;

function ChatView() {
  const t = useTranslations("chat");
  const params = useSearchParams();
  const prefill = params.get("q") ?? "";
  const {
    messages,
    isLoading,
    isLoadingThread,
    error,
    threadId,
    sendMessage,
    newChat,
    openThread,
    dismissError,
  } = useChat();
  const [historyOpen, setHistoryOpen] = useState(false);
  const inputRef = useRef<ChatInputHandle>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // A question handed over from the dashboard: prefill (never auto-send; the user decides).
  useEffect(() => {
    if (prefill) {
      inputRef.current?.set(prefill);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [prefill]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isLoading]);

  const startNew = () => {
    newChat();
    setHistoryOpen(false);
    inputRef.current?.focus();
  };

  const empty = messages.length === 0 && !isLoading && !isLoadingThread;

  return (
    <div className="flex h-[calc(100dvh-13.5rem)] min-h-[420px] gap-6 md:h-[calc(100dvh-5.5rem)]">
      <aside className="hidden w-64 shrink-0 lg:flex">
        <ThreadList activeId={threadId} onOpen={openThread} onNew={startNew} className="w-full" />
      </aside>

      <section className="flex min-w-0 flex-1 flex-col" aria-labelledby="chat-title">
        <header className="flex shrink-0 items-center justify-between gap-3 pb-4">
          <div className="flex items-center gap-3">
            <h1 id="chat-title" className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
              {t("title")}
            </h1>
            <span className="rounded-full bg-lime px-2 py-0.5 text-[11px] font-semibold text-ink">{t("aiBadge")}</span>
          </div>
          <div className="flex gap-2 lg:hidden">
            <Button variant="outline" size="icon" onClick={() => setHistoryOpen(true)} aria-label={t("threads.title")}>
              <History className="size-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={startNew} aria-label={t("threads.new")}>
              <MessageSquarePlus className="size-4" />
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-3xl border border-border/70 bg-muted/30 p-4 sm:p-6" aria-live="polite">
          {isLoadingThread ? (
            <div className="space-y-4">
              <Skeleton className="ms-auto h-12 w-1/2 rounded-3xl" />
              <Skeleton className="h-24 w-2/3 rounded-3xl" />
            </div>
          ) : empty ? (
            <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center gap-6 py-6 text-center">
              <Wara pose="hello" className="w-28 text-ink dark:text-bone" />
              <div className="space-y-2">
                <p className="font-heading text-2xl font-bold">{t("empty.title")}</p>
                <p className="text-muted-foreground">{t("empty.body")}</p>
              </div>
              <div className="grid w-full gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => void sendMessage(t(`suggestions.${k}`))}
                    className="cursor-pointer rounded-2xl border border-border bg-card px-4 py-3 text-start text-sm font-medium shadow-paper transition-[transform,border-color] hover:-translate-y-0.5 hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {t(`suggestions.${k}`)}
                  </button>
                ))}
              </div>
              <p className="flex items-start gap-2 text-start text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
                {t("empty.trust")}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {messages.map((m) => (
                <ChatMessage key={m.id} message={m} />
              ))}
              {isLoading && <Thinking />}
              {error && <ChatErrorCard error={error} onDismiss={dismissError} />}
            </div>
          )}
          {empty && error && <ChatErrorCard error={error} onDismiss={dismissError} />}
          <div ref={bottomRef} className="h-px" aria-hidden />
        </div>

        <div className="shrink-0 pt-3">
          <ChatInput ref={inputRef} onSend={(m) => void sendMessage(m)} disabled={isLoading} />
        </div>
      </section>

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="start" className="p-5">
          <SheetHeader className="p-0 pb-4">
            <SheetTitle>{t("threads.title")}</SheetTitle>
          </SheetHeader>
          <ThreadList
            activeId={threadId}
            onOpen={(id) => {
              void openThread(id);
              setHistoryOpen(false);
            }}
            onNew={startNew}
            className="min-h-0 flex-1"
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatView />
    </Suspense>
  );
}
