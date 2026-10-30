import { Wara, type WaraPose } from "@/components/illustrations/Wara";
import { cn } from "@/lib/utils";

/** Mascot + a short, kind line + exactly one useful next action. */
export function EmptyState({
  pose = "sleeping",
  title,
  description,
  action,
  className,
  compact = false,
}: {
  pose?: WaraPose;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        compact ? "gap-3 py-8" : "gap-5 py-14",
        className,
      )}
    >
      <Wara pose={pose} className={cn("text-ink dark:text-bone", compact ? "w-24" : "w-36 sm:w-40")} />
      <div className="max-w-sm space-y-1.5">
        <p className={cn("font-heading font-semibold", compact ? "text-base" : "text-xl")}>{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
