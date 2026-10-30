import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Every number on the landing page is illustrative, and says so. */
export function DemoTag({ className }: { className?: string }) {
  const t = useTranslations("landing");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-dashed border-current/40 bg-background/80 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground backdrop-blur",
        className,
      )}
    >
      {t("demoTag")}
    </span>
  );
}
