"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

/** Bouncing dots + optional delay hint for assistant “typing”. */
export function TypingIndicator() {
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setShowHint(true), 5000);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="flex max-w-[75%] justify-start">
      <div className="rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3 text-card-foreground">
        <div className="flex items-center gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="inline-block size-2 rounded-full bg-muted-foreground/60"
              animate={{ y: [0, -5, 0] }}
              transition={{
                duration: 0.55,
                repeat: Infinity,
                delay: i * 0.15,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
        {showHint ? (
          <p className="mt-2 text-xs text-muted-foreground">
            This may take a moment...
          </p>
        ) : null}
      </div>
    </div>
  );
}
