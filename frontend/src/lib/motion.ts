import type { Transition, Variants } from "framer-motion";

/** Shared motion tokens: one rhythm across the product. */
export const duration = { fast: 0.15, base: 0.22, slow: 0.42 } as const;
export const ease = {
  out: [0.22, 1, 0.36, 1] as const,
  in: [0.55, 0, 1, 0.45] as const,
};
export const spring: Transition = { type: "spring", stiffness: 380, damping: 32, mass: 0.8 };
export const softSpring: Transition = { type: "spring", stiffness: 160, damping: 22 };

export const rise: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: duration.slow, ease: ease.out } },
};

export const stagger = (step = 0.045, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: step, delayChildren: delay } },
});
