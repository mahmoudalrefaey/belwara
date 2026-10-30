import { cn } from "@/lib/utils";

/**
 * The mark: Wara'a's receipt silhouette. Its mouth is a tick, "checked, to the letter".
 * Lime fill with an outline in currentColor so it reads on bone and on ink.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path
        d="M8 3.5h16a2.5 2.5 0 0 1 2.5 2.5v20.5l-3.08-2.2-3.09 2.2-3.08-2.2-3.08 2.2-3.09-2.2-3.08 2.2V6A2.5 2.5 0 0 1 8 3.5Z"
        fill="#c6f432"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <circle cx="12.4" cy="11.6" r="1.7" fill="#0a0a0b" />
      <circle cx="19.6" cy="11.6" r="1.7" fill="#0a0a0b" />
      <path
        d="M11.6 16.6l3 2.9 5.8-6"
        fill="none"
        stroke="#0a0a0b"
        strokeWidth={2.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Mark + bilingual wordmark. The Arabic name leads; the Latin name supports it. */
export function Logo({
  className,
  markClassName,
  compact = false,
}: {
  className?: string;
  markClassName?: string;
  /** Arabic name only, no Latin subline. */
  compact?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <span className="flex flex-col leading-none">
        <span className="font-heading text-[1.35em] font-bold tracking-tight" lang="ar">
          بالورقة
        </span>
        {!compact && (
          <span className="mt-1 font-mono text-[0.62em] font-medium uppercase tracking-[0.18em] opacity-70" lang="en">
            Bel War’a
          </span>
        )}
      </span>
      <span className="sr-only">Bel War’a</span>
    </span>
  );
}
