"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Camera, LayoutGrid, LogOut, MessagesSquare, ReceiptText, UserRound } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { useUsage } from "@/hooks/useUser";
import { useUpload } from "@/components/layout/UploadProvider";
import { Logo } from "@/components/brand/Logo";
import { Meter } from "@/components/common/Meter";
import { LanguageSwitcher, ThemeSwitch } from "@/components/common/Toggles";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/dashboard", key: "dashboard", icon: LayoutGrid },
  { href: "/receipts", key: "receipts", icon: ReceiptText },
  { href: "/chat", key: "chat", icon: MessagesSquare },
  { href: "/profile", key: "profile", icon: UserRound },
] as const;

export function initialsOf(name: string | null | undefined, email: string | undefined) {
  if (name?.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  return email?.slice(0, 2).toUpperCase() ?? "?";
}

/** Desktop rail: always ink, the brand's signature surface. */
export default function Sidebar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { openUpload } = useUpload();
  const { data: usage } = useUsage();

  return (
    <aside className="fixed inset-y-0 start-0 z-40 hidden w-64 flex-col border-e border-white/[0.07] bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-20 items-center px-6">
        <Link href="/dashboard" className="rounded-lg text-bone focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime">
          <Logo className="text-[15px]" markClassName="size-9 text-ink" />
        </Link>
      </div>

      <div className="px-4">
        <button
          type="button"
          onClick={openUpload}
          className="group flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-lime px-4 py-3 text-start text-ink shadow-[inset_0_-3px_0_rgb(10_10_11/0.25)] transition-transform active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-ink text-lime transition-transform group-hover:-rotate-6">
            <Camera className="size-[18px]" aria-hidden />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-heading font-semibold">{t("scan")}</span>
            <span className="text-xs opacity-70">{t("scanHint")}</span>
          </span>
        </button>
      </div>

      <nav aria-label={t("label")} className="mt-6 flex-1 space-y-1 px-3">
        {NAV.map(({ href, key, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-lime",
                active ? "text-ink" : "text-bone/65 hover:bg-white/5 hover:text-bone",
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-pill"
                  transition={spring}
                  className="absolute inset-0 rounded-xl bg-lime"
                  aria-hidden
                />
              )}
              <Icon className="relative size-5" strokeWidth={1.75} aria-hidden />
              <span className="relative">{t(key)}</span>
            </Link>
          );
        })}
      </nav>

      {usage && (
        <Link
          href="/profile#usage"
          className="mx-4 mb-4 block space-y-2.5 rounded-2xl border border-white/10 p-4 transition-colors hover:bg-white/5"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono uppercase tracking-wider text-bone/60">
              {t(usage.plan === "pro" ? "planPro" : "planFree")}
            </span>
            <span className="num text-bone/80">
              {usage.receipts.used}
              {usage.receipts.limit ? ` / ${usage.receipts.limit}` : ""}
            </span>
          </div>
          {usage.receipts.limit > 0 && (
            <Meter value={usage.receipts.used} max={usage.receipts.limit} label={t("usageLabel")} tone="inverse" />
          )}
          <p className="text-xs text-bone/60">{t("usageHint")}</p>
        </Link>
      )}

      <div className="flex items-center justify-between gap-2 px-4 pb-3">
        <LanguageSwitcher tone="inverse" />
        <ThemeSwitch tone="inverse" />
      </div>

      <div className="flex items-center gap-3 border-t border-sidebar-border px-5 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink-3 font-heading text-sm font-semibold text-lime">
          {initialsOf(user?.full_name, user?.email)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user?.full_name || user?.email}</p>
          {user?.full_name && <p className="truncate text-xs text-bone/50">{user.email}</p>}
        </div>
        <button
          type="button"
          onClick={logout}
          aria-label={t("logout")}
          title={t("logout")}
          className="grid size-9 cursor-pointer place-items-center rounded-full text-bone/60 transition-colors hover:bg-white/10 hover:text-bone focus-visible:outline-2 focus-visible:outline-lime"
        >
          <LogOut className="size-4 rtl:-scale-x-100" aria-hidden />
        </button>
      </div>
    </aside>
  );
}
