"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { useRouter, usePathname, Link } from "@/i18n/navigation";
import { useAuth } from "@/providers/AuthProvider";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import { UploadProvider } from "@/components/layout/UploadProvider";
import { useReceiptWatcher } from "@/hooks/useReceiptWatcher";
import { Logo } from "@/components/brand/Logo";
import { Wara } from "@/components/illustrations/Wara";
import { duration, ease } from "@/lib/motion";

function Watcher() {
  useReceiptWatcher();
  return null;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("common");
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/login");
  }, [isAuthenticated, isLoading, router]);

  // Move focus to the new page for keyboard and screen-reader users (not on first load).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy="true">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Wara pose="reading" className="w-24 text-ink dark:text-bone" />
          <span className="shimmer-text text-sm font-medium">{t("loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <UploadProvider>
      <Watcher />
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-lime px-4 py-2 text-ink focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {t("skipToContent")}
      </a>
      <Sidebar />
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/60 bg-background/85 px-4 backdrop-blur-md md:hidden">
        <Link href="/dashboard" aria-label={t("home")}>
          <Logo className="text-sm" markClassName="size-8 text-ink dark:text-bone" />
        </Link>
      </header>
      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        className="min-h-dvh pb-32 outline-none md:ms-64 md:pb-12"
      >
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: duration.base, ease: ease.out }}
          className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 md:pt-10 lg:px-10"
        >
          {children}
        </motion.div>
      </main>
      <BottomNav />
    </UploadProvider>
  );
}
