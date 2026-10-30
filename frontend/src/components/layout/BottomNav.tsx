"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Camera } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { useUpload } from "@/components/layout/UploadProvider";
import { NAV } from "@/components/layout/Sidebar";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Phone navigation: four destinations plus a raised lime "Scan" in the thumb's reach. */
export default function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { openUpload } = useUpload();
  const [a, b, c, d] = NAV;

  const item = ({ href, key, icon: Icon }: (typeof NAV)[number]) => {
    const active = pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-lime",
          active ? "text-lime" : "text-bone/60",
        )}
      >
        {active && (
          <motion.span
            layoutId="tab-dot"
            transition={spring}
            className="absolute top-1.5 h-1 w-6 rounded-full bg-lime"
            aria-hidden
          />
        )}
        <Icon className="size-[22px]" strokeWidth={1.75} aria-hidden />
        {t(key)}
      </Link>
    );
  };

  return (
    <nav
      aria-label={t("label")}
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex items-stretch rounded-3xl bg-ink px-1 shadow-lift ring-1 ring-white/10 md:hidden"
    >
      {item(a)}
      {item(b)}
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          onClick={openUpload}
          aria-label={t("scan")}
          className="-mt-5 grid size-16 cursor-pointer place-items-center rounded-full bg-lime text-ink shadow-[0_6px_0_rgb(10_10_11/0.9),0_10px_24px_-6px_rgb(198_244_50/0.5)] ring-4 ring-background transition-transform active:translate-y-0.5 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime"
        >
          <Camera className="size-7" strokeWidth={2} aria-hidden />
        </button>
      </div>
      {item(c)}
      {item(d)}
    </nav>
  );
}
