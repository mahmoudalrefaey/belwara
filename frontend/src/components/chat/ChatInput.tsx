"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_PX = 160;

export type ChatInputHandle = { focus: () => void; set: (v: string) => void };

export const ChatInput = forwardRef<
  ChatInputHandle,
  { onSend: (message: string) => void; disabled: boolean; initial?: string }
>(function ChatInput({ onSend, disabled, initial = "" }, ref) {
  const t = useTranslations("chat.input");
  const [value, setValue] = useState(initial);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => taRef.current?.focus(),
    set: (v: string) => {
      setValue(v);
      requestAnimationFrame(() => taRef.current?.focus());
    },
  }));

  const resize = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_PX)}px`;
  }, []);

  useEffect(resize, [value, resize]);

  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !disabled;

  const submit = () => {
    if (!canSend) return;
    onSend(trimmed);
    setValue("");
  };

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          "flex items-end gap-2 rounded-[28px] border border-input bg-card p-2 ps-5 shadow-paper transition-[border-color,box-shadow]",
          "focus-within:border-foreground focus-within:ring-4 focus-within:ring-lime/40",
        )}
      >
        <textarea
          ref={taRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={t("placeholder")}
          aria-label={t("label")}
          className="max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2 text-base outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          aria-label={t("send")}
          className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full bg-lime text-ink shadow-[inset_0_-2px_0_rgb(10_10_11/0.22)] transition-[transform,opacity] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowUp className="size-5" strokeWidth={2.25} />
        </button>
      </div>
      <p className="hidden px-5 text-[11px] text-muted-foreground pointer-fine:block">{t("hint")}</p>
    </div>
  );
});
