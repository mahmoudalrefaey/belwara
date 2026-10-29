"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import type { ChatMessage, ChatMessageOut, ChatResponse } from "@/types/api";

const THREAD_KEY = "spendhist_thread_id";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(THREAD_KEY);
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // History lives on the server; load the current thread once on mount.
  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current || !threadId) return;
    loadedRef.current = true;
    api
      .get<ChatMessageOut[]>(`/chat/threads/${encodeURIComponent(threadId)}`)
      .then(({ data }) =>
        setMessages(
          data.map((m) => ({
            id: crypto.randomUUID(),
            role: m.role,
            content: m.content,
            timestamp: m.created_at,
            thread_id: threadId,
          })),
        ),
      )
      .catch(() => {
        // Unknown or deleted thread: start fresh.
        setThreadId(null);
        localStorage.removeItem(THREAD_KEY);
      });
  }, [threadId]);

  const sendMessage = useCallback(
    async (content: string) => {
      setError(null);
      loadedRef.current = true;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

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

        setThreadId(data.thread_id);
        localStorage.setItem(THREAD_KEY, data.thread_id);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.reply,
            timestamp: new Date().toISOString(),
            thread_id: data.thread_id,
          },
        ]);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "CanceledError") return;
        const res = (err as { response?: { status?: number; data?: { detail?: { message?: string } } } })
          .response;
        setError(
          res?.status === 402 && res.data?.detail?.message
            ? res.data.detail.message
            : "Assistant unavailable. Please try again in a moment.",
        );
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
  }, []);

  return { messages, isLoading, error, threadId, sendMessage, clearChat };
}
