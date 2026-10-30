"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useRouter } from "@/i18n/navigation";
import { isAuthenticated } from "@/lib/auth";
import { Logo } from "@/components/brand/Logo";
import { Wara, type WaraPose } from "@/components/illustrations/Wara";
import { Highlighter } from "@/components/common/Highlighter";
import { LanguageSwitcher } from "@/components/common/Toggles";
import { MascotContext } from "@/components/auth/MascotContext";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("auth.side");
  const router = useRouter();
  const [pose, setPose] = useState<WaraPose>("hello");

  useEffect(() => {
    if (isAuthenticated()) router.replace("/dashboard");
  }, [router]);

  return (
    <MascotContext.Provider value={setPose}>
      <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
        {/* Ink panel */}
        <section className="relative flex flex-col justify-between overflow-hidden border-white/10 bg-ink dark:border-b lg:dark:border-b-0 lg:dark:border-e px-6 pb-6 pt-6 text-bone sm:px-10 lg:min-h-dvh lg:px-14 lg:py-12">
          <div className="flex items-center justify-between">
            <Link href="/" className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime">
              <Logo className="text-sm sm:text-base" markClassName="size-9 text-ink" />
            </Link>
            <LanguageSwitcher tone="inverse" />
          </div>

          <div className="relative mt-6 flex items-end gap-4 lg:mt-0 lg:flex-col lg:items-start lg:gap-10">
            <div className="relative w-28 shrink-0 sm:w-32 lg:w-60">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={pose}
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
                  transition={{ duration: 0.2 }}
                >
                  <Wara pose={pose} className="w-full text-bone" />
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="space-y-3 pb-2 lg:max-w-md">
              <h2 className="font-heading text-2xl font-bold leading-tight sm:text-3xl lg:text-5xl">
                {t.rich("headline", { mark: (c) => <Highlighter className="[--hl-fg:var(--color-ink)]">{c}</Highlighter> })}
              </h2>
              <p className="hidden text-bone/70 sm:block lg:text-lg">{t("sub")}</p>
            </div>
          </div>

          <ul className="mt-10 hidden gap-3 text-sm text-bone/75 lg:grid">
            {(["one", "two", "three"] as const).map((k, i) => (
              <li key={k} className="flex items-center gap-3">
                <span className="grid size-7 place-items-center rounded-full border border-white/15 font-mono text-xs text-lime">
                  {i + 1}
                </span>
                {t(`steps.${k}`)}
              </li>
            ))}
          </ul>
        </section>

        {/* Paper panel */}
        <section className="flex items-start justify-center px-5 py-10 sm:px-10 lg:items-center lg:py-12">
          <div className="w-full max-w-md">{children}</div>
        </section>
      </div>
    </MascotContext.Provider>
  );
}
