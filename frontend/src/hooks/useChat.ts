"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorDetail, errorStatus } from "@/lib/api";
import { KEYS, read } from "@/lib/storage";
import type {
  ChatMessage,
  ChatMessageOut,
  ChatResponse,
  ChatThreadSummary,
} from "@/types/api";

export type ChatError = { kind: "quota" | "rate" | "generic"; detail?: string };

function toMessages(rows: ChatMessageOut[], threadId: string): ChatMessage[] {
  return rows.map((m) => ({
    id: crypto.randomUUID(),
    role: m.role,
    content: m.content,
    timestamp: m.created_at,
    thread_id: threadId,
  }));
}

/** Past conversations, newest first (stored on the server). */
export function useChatThreads() {
  return useQuery<ChatThreadSummary[]>({
    queryKey: ["chat-threads"],
    queryFn: async () => {
      const { data } = await api.get("/chat/threads");
      return data;
    },
    staleTime: 30_000,
  });
}

export function useChat() {
  const qc = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(() => read(KEYS.thread));
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadThread = useCallback(async (id: string) => {
    setIsLoadingThread(true);
    try {
      const { data } = await api.get<ChatMessageOut[]>(
        `/chat/threads/${encodeURIComponent(id)}`,
      );
      setMessages(toMessages(data, id));
      setThreadId(id);
      localStorage.setItem(KEYS.thread, id);
    } catch {
      // Unknown or deleted thread: start fresh.
      setThreadId(null);
      setMessages([]);
      localStorage.removeItem(KEYS.thread);
    } finally {
      setIsLoadingThread(false);
    }
  }, []);

  // History lives on the server; load the remembered thread once on mount.
  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    if (threadId) void loadThread(threadId);
  }, [threadId, loadThread]);

  const sendMessage = useCallback(
    async (content: string) => {
      setError(null);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "user",
          content,
          timestamp: new Date().toISOString(),
        },
      ]);

      setIsLoading(true);
      abortRef.current = new AbortController();

      try {
        const { data } = await api.post<ChatResponse>(
          "/chat",
          { message: content, thread_id: threadId ?? undefined },
          { signal: abortRef.current.signal },
        );

        setThreadId(data.thread_id);
        localStorage.setItem(KEYS.thread, data.thread_id);
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
        qc.invalidateQueries({ queryKey: ["chat-threads"] });
        qc.invalidateQueries({ queryKey: ["usage"] });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "CanceledError") return;
        const status = errorStatus(err);
        setError({
          kind: status === 402 ? "quota" : status === 429 ? "rate" : "generic",
          detail: errorDetail(err),
        });
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [threadId, qc],
  );

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setThreadId(null);
    setError(null);
    localStorage.removeItem(KEYS.thread);
  }, []);

  return {
    messages,
    isLoading,
    isLoadingThread,
    error,
    threadId,
    sendMessage,
    newChat,
    openThread: loadThread,
    dismissError: () => setError(null),
  };
}
