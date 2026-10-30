"use client";

import { useSyncExternalStore, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Languages, Monitor, Moon, Sun } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { setPrefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";

/** ع / EN: switches language and keeps the current page and query. */
export function LanguageSwitcher({
  className,
  tone = "default",
  compact = false,
}: {
  className?: string;
  tone?: "default" | "inverse";
  /** Short label (ع / EN) for tight spaces like the phone top bar. */
  compact?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const next = locale === "ar" ? "en" : "ar";

  return (
    <button
      type="button"
      onClick={() => {
        // Read the query at click time (keeps static pages static).
        const query = window.location.search.slice(1);
        start(() => router.replace(query ? `${pathname}?${query}` : pathname, { locale: next }));
      }}
      disabled={pending}
      aria-label={t("switchLanguage")}
      className={cn(
        "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60",
        tone === "inverse"
          ? "border-white/15 text-bone hover:bg-white/10"
          : "border-border hover:bg-accent",
        className,
      )}
    >
      <Languages className="size-4" aria-hidden />
      <span lang={next} aria-hidden={compact || undefined}>
        {compact ? t("languageShort") : next === "ar" ? "عربي" : "English"}
      </span>
    </button>
  );
}

const THEMES = [
  { id: "light", icon: Sun },
  { id: "dark", icon: Moon },
  { id: "system", icon: Monitor },
] as const;

/** Segmented theme control. */
export function ThemeSwitch({ className, tone = "default" }: { className?: string; tone?: "default" | "inverse" }) {
  const t = useTranslations("common.theme");
  const { theme, setTheme } = useTheme();
  // The stored theme is only known in the browser; render neutral on the server.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <div
      role="radiogroup"
      aria-label={t("label")}
      className={cn(
        "inline-flex rounded-full border p-0.5",
        tone === "inverse" ? "border-white/15" : "border-border bg-card",
        className,
      )}
    >
      {THEMES.map(({ id, icon: Icon }) => {
        const active = mounted && (theme ?? "system") === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t(id)}
            title={t(id)}
            onClick={() => {
              setTheme(id);
              setPrefs({ theme: id });
            }}
            className={cn(
              "grid size-8 cursor-pointer place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
              active
                ? "bg-primary text-primary-foreground"
                : tone === "inverse"
                  ? "text-bone/70 hover:text-bone"
                  : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
