"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "@/types/api";
import { LogoMark } from "@/components/brand/Logo";
import { ChatReceiptCards } from "@/components/chat/ChatReceiptCards";
import { Link } from "@/i18n/navigation";
import { useFormat } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Set amounts like "245.00 EGP" in the receipt-printer voice (inline code → mono chip). */
const AMOUNT =
  /(?<![`\w])(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s?(EGP|USD|SAR|EUR|GBP|AED|KWD|QAR|جنيه(?: مصري)?|ريال(?: سعودي)?|دولار(?: أمريكي)?)(?!\p{L})/gu;
const markAmounts = (s: string) => s.replace(AMOUNT, "`$1 $2`");

export function ChatMessage({ message }: { message: ChatMessageType }) {
  const t = useTranslations("chat");
  const f = useFormat();
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex w-full gap-3", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && <LogoMark className="mt-1 size-9 shrink-0 text-ink dark:text-bone" />}
      <div className={cn("max-w-[85%] space-y-1.5 sm:max-w-[75%]", isUser && "items-end")}>
        {!isUser && <p className="px-2 text-xs font-semibold text-muted-foreground">{t("assistantName")}</p>}
        <div
          className={cn(
            "px-4 py-3 leading-relaxed",
            isUser
              ? "rounded-3xl rounded-ee-md bg-ink text-bone dark:bg-lime dark:text-ink"
              : "rounded-3xl rounded-ss-md border border-border/70 bg-card shadow-paper",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <div
              className={cn(
                "prose prose-sm max-w-none break-words dark:prose-invert",
                "prose-p:my-1.5 prose-ul:my-2 prose-li:my-0.5 prose-headings:font-heading prose-strong:font-semibold",
                "prose-code:rounded-md prose-code:bg-lime/30 prose-code:px-1.5 prose-code:py-0.5 prose-code:font-mono prose-code:text-[0.92em] prose-code:font-medium prose-code:before:content-none prose-code:after:content-none dark:prose-code:bg-lime/15 dark:prose-code:text-lime",
                "prose-table:text-sm [&_pre]:max-w-full [&_pre]:overflow-x-auto",
              )}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // App paths stay in the app; anything else opens in a new tab.
                  a: ({ href, children }) =>
                    href?.startsWith("/") ? (
                      <Link href={href}>{children}</Link>
                    ) : (
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {children}
                      </a>
                    ),
                  code: ({ children, ...props }) => (
                    <code dir="ltr" {...props}>
                      {children}
                    </code>
                  ),
                }}
              >
                {markAmounts(message.content)}
              </ReactMarkdown>
            </div>
          )}
        </div>
        {!isUser && message.receipts?.length ? <ChatReceiptCards receipts={message.receipts} /> : null}
        <p className={cn("flex items-center gap-1.5 px-2 text-[11px] text-muted-foreground", isUser && "justify-end")}>
          {!isUser && (
            <>
              <Sparkles className="size-3" aria-hidden />
              <span>{t("aiFootnote")}</span>
              <span aria-hidden>·</span>
            </>
          )}
          <time dateTime={message.timestamp}>{f.relative(message.timestamp)}</time>
        </p>
      </div>
    </motion.div>
  );
}
