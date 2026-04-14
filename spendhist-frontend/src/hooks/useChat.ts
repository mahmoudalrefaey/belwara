"use client";

import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import type { ChatMessage, ChatResponse } from "@/types/api";

const THREAD_KEY = "spendhist_thread_id";
const MESSAGES_KEY = "spendhist_chat_messages";

function loadMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MESSAGES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistMessages(msgs: ChatMessage[]) {
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(msgs));
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [threadId, setThreadId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(THREAD_KEY);
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      setError(null);

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => {
        const next = [...prev, userMsg];
        persistMessages(next);
        return next;
      });

      setIsLoading(true);
      abortRef.current = new AbortController();

      try {
        const { data } = await api.post<ChatResponse>(
          "/chat",
          {
            message: content,
            thread_id: threadId ?? undefined,
          },
          { signal: abortRef.current.signal },
        );

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply,
          timestamp: new Date().toISOString(),
          thread_id: data.thread_id,
        };

        setThreadId(data.thread_id);
        localStorage.setItem(THREAD_KEY, data.thread_id);

        setMessages((prev) => {
          const next = [...prev, assistantMsg];
          persistMessages(next);
          return next;
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "CanceledError") return;
        setError("Assistant unavailable. Please try again in a moment.");
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [threadId],
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setThreadId(null);
    setError(null);
    localStorage.removeItem(THREAD_KEY);
    localStorage.removeItem(MESSAGES_KEY);
  }, []);

  return { messages, isLoading, error, threadId, sendMessage, clearChat };
}
