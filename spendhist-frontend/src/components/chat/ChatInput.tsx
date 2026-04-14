"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const MAX_LINES = 4;
const LINE_PX = 22;

type ChatInputProps = {
  onSend: (message: string) => void;
  disabled: boolean;
};

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    const cap = MAX_LINES * LINE_PX + 16;
    el.style.height = `${Math.min(el.scrollHeight, cap)}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [value, resize]);

  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !disabled;

  const submit = () => {
    if (!canSend) return;
    onSend(trimmed);
    setValue("");
    requestAnimationFrame(resize);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex items-end gap-2">
      <Textarea
        ref={taRef}
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Message the assistant…"
        disabled={disabled}
        className={cn(
          "min-h-10 max-h-[calc(4*22px+16px)] resize-none overflow-y-auto py-2.5",
          "field-sizing-fixed",
        )}
        aria-label="Chat message"
      />
      <Button
        type="button"
        size="icon"
        className="shrink-0"
        disabled={!canSend}
        onClick={submit}
        aria-label="Send message"
      >
        <SendHorizontal className="size-4" />
      </Button>
    </div>
  );
}
