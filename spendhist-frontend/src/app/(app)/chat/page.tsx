"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useChat } from "@/hooks/useChat";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SUGGESTIONS = [
  "How much did I spend this month?",
  "What are my top merchants?",
] as const;

export default function ChatPage() {
  const { messages, isLoading, error, sendMessage, clearChat } = useChat();
  const [clearOpen, setClearOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: isLoading ? "auto" : messages.length > 0 ? "smooth" : "auto",
      block: "end",
    });
  }, [messages, isLoading]);

  return (
    <div className="flex h-[calc(100dvh-theme(spacing.12))] min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 pb-4">
        <h1 className="text-lg font-semibold tracking-tight">AI Assistant</h1>
        <Button type="button" variant="outline" size="sm" onClick={() => setClearOpen(true)}>
          New Chat
        </Button>
      </header>

      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Clear conversation?</DialogTitle>
            <DialogDescription>
              This will clear your chat history. The AI won&apos;t remember this
              conversation.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setClearOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                clearChat();
                setClearOpen(false);
              }}
            >
              Clear conversation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScrollArea className="min-h-0 flex-1 pr-2">
        <div className="flex flex-col gap-3 pb-4">
          {messages.length === 0 && !isLoading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 py-12 text-center">
              <div className="max-w-md space-y-2">
                <p className="text-base font-medium text-foreground">
                  Ask anything about your spending
                </p>
                <p className="text-sm text-muted-foreground">
                  Try one of the suggestions below, or type your own question.
                </p>
              </div>
              <div className="flex w-full max-w-lg flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
                {SUGGESTIONS.map((text) => (
                  <Button
                    key={text}
                    type="button"
                    variant="secondary"
                    className="h-auto whitespace-normal px-4 py-3 text-left text-sm"
                    onClick={() => void sendMessage(text)}
                  >
                    {text}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          <AnimatePresence initial={false} mode="popLayout">
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <ChatMessage message={m} />
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading ? <TypingIndicator /> : null}
          <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t border-border pt-3">
        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </div>
  );
}
