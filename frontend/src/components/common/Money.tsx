"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";
import { useFormat } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Amount in the receipt-printer voice: mono, tabular, currency code small and quiet. */
export function Money({
  amount,
  currency,
  className,
  codeClassName,
}: {
  amount: number | string | null | undefined;
  currency?: string | null;
  className?: string;
  codeClassName?: string;
}) {
  const f = useFormat();
  if (amount == null) return <span className={cn("num", className)}>—</span>;
  return (
    <span className={cn("num whitespace-nowrap", className)} dir="ltr">
      {f.money(amount)}
      {currency && (
        <span className={cn("ms-1 text-[0.62em] font-medium tracking-wider opacity-60", codeClassName)}>
          {currency}
        </span>
      )}
    </span>
  );
}

/** Counts up once to the real value when it first comes into view. */
export function CountUp({
  value,
  currency,
  className,
  codeClassName,
}: {
  value: number;
  currency?: string | null;
  className?: string;
  codeClassName?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [animated, setShown] = useState(0);
  const shown = reduce ? value : animated;

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: setShown,
    });
    return () => controls.stop();
  }, [inView, value, reduce]);

  return (
    <span ref={ref}>
      <Money amount={shown} currency={currency} className={className} codeClassName={codeClassName} />
      <span className="sr-only">
        <Money amount={value} currency={currency} />
      </span>
    </span>
  );
}
