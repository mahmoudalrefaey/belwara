"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { Logo } from "@/components/brand/Logo";
import { LanguageSwitcher } from "@/components/common/Toggles";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = ["how", "features", "pricing", "faq"] as const;

export function LandingHeader() {
  const t = useTranslations("landing.nav");
  const { isAuthenticated } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-300",
        scrolled ? "bg-ink/85 shadow-[0_1px_0_rgb(255_255_255/0.08)] backdrop-blur-md" : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-5 text-bone sm:px-8">
        <Link href="/" aria-label={t("home")} className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime">
          <Logo className="text-sm sm:text-[15px]" markClassName="size-9 text-ink" />
        </Link>

        <nav aria-label={t("label")} className="hidden items-center gap-1 lg:flex">
          {LINKS.map((k) => (
            <a
              key={k}
              href={`#${k}`}
              className="rounded-full px-4 py-2 text-sm font-medium text-bone/75 transition-colors hover:bg-white/10 hover:text-bone"
            >
              {t(k)}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher tone="inverse" compact className="sm:hidden" />
          <LanguageSwitcher tone="inverse" className="hidden sm:inline-flex" />
          {isAuthenticated ? (
            <Link href="/dashboard" className={buttonVariants({ size: "sm", className: "h-9 px-4" })}>
              {t("openDashboard")}
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-full px-4 py-2 text-sm font-medium text-bone/85 hover:bg-white/10 hover:text-bone sm:inline-flex"
              >
                {t("login")}
              </Link>
              <Link href="/register" className={buttonVariants({ size: "sm", className: "h-9 px-4" })}>
                {t("start")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
