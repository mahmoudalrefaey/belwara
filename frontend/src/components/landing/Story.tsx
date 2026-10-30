"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Highlighter } from "@/components/common/Highlighter";
import { Wara } from "@/components/illustrations/Wara";
import { DemoTag } from "@/components/landing/DemoTag";
import { LogoMark } from "@/components/brand/Logo";
import { ease } from "@/lib/motion";

type DemoItem = { name: string; total: string };

/** Act 3: the AI reads each field, and every field says it was read by AI. */
export function Understand() {
  const t = useTranslations("landing.understand");
  const td = useTranslations("landing.demo");
  const items = td.raw("items") as DemoItem[];

  const fields = [
    { key: "merchant", node: <p className="text-center font-heading text-lg font-bold">{td("merchant")}</p> },
    { key: "date", node: <p className="num text-center text-xs text-ink/60">{td("date")}</p> },
    {
      key: "items",
      node: (
        <ul className="space-y-1.5 text-sm">
          {items.map((it) => (
            <li key={it.name} className="flex items-end gap-2">
              <span>{it.name}</span>
              <span className="leader" aria-hidden />
              <span className="num">{it.total}</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      key: "total",
      node: (
        <div className="flex items-end gap-2 text-base font-semibold">
          <span>{td("totalLabel")}</span>
          <span className="leader" aria-hidden />
          <span className="num" dir="ltr">{td("total")}</span>
        </div>
      ),
    },
  ] as const;

  return (
    <section className="bg-background pb-24 pt-10 sm:pb-32 sm:pt-12" aria-labelledby="understand-title">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-2">
        <div className="relative order-2 mx-auto w-full max-w-sm lg:order-1">
          <DemoTag className="absolute -top-8 start-0" />
          <div className="drop-shadow-[0_18px_28px_rgb(10_10_11/0.18)]">
            <motion.div
              className="edge-torn rounded-t-2xl bg-paper px-6 pb-10 pt-6 text-ink"
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.5 }}
              variants={{ show: { transition: { staggerChildren: 0.45, delayChildren: 0.2 } } }}
            >
              {fields.map((f, i) => (
                <motion.div
                  key={f.key}
                  className="relative my-3 rounded-lg px-2 pb-1.5 pt-3"
                  variants={{
                    hidden: { backgroundColor: "rgba(198,244,50,0)" },
                    show: {
                      backgroundColor: ["rgba(198,244,50,0)", "rgba(198,244,50,0.55)", "rgba(198,244,50,0.18)"],
                      transition: { duration: 0.9, ease: ease.out },
                    },
                  }}
                >
                  {f.node}
                  <motion.span
                    variants={{ hidden: { opacity: 0, y: 4 }, show: { opacity: 1, y: 0, transition: { delay: 0.25 } } }}
                    className="absolute -top-2.5 end-2 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-ink px-2 py-0.5 text-[10px] font-medium text-lime"
                  >
                    <Sparkles className="size-3" aria-hidden />
                    {t(`fields.${f.key}`)}
                  </motion.span>
                  {i < 3 && i !== 0 && <div className="mt-3 border-t-2 border-dashed border-ink/15" />}
                </motion.div>
              ))}
            </motion.div>
          </div>
          <Wara pose="reading" className="absolute -bottom-10 -end-6 w-24 text-ink dark:text-bone" />
        </div>

        <div className="order-1 space-y-6 lg:order-2">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("eyebrow")}</p>
          <h2 id="understand-title" className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">
            {t.rich("title", { mark: (c) => <Highlighter>{c}</Highlighter> })}
          </h2>
          <p className="max-w-lg text-lg text-muted-foreground">{t("body")}</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {(["review", "edit"] as const).map((k) => (
              <li key={k} className="rounded-2xl border border-border bg-card p-4 shadow-paper">
                <p className="font-heading font-semibold">{t(`points.${k}.title`)}</p>
                <p className="text-sm text-muted-foreground">{t(`points.${k}.body`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** Act 4: clarity. An illustrative month and a question answered in Arabic. */
export function Clarity() {
  const t = useTranslations("landing.clarity");
  const bars = t.raw("bars") as { label: string; value: number; amount: string }[];
  const max = Math.max(...bars.map((b) => b.value));
  return (
    <section className="relative overflow-hidden bg-ink py-24 text-bone sm:py-32" aria-labelledby="clarity-title">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="max-w-2xl space-y-4">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-bone/50">{t("eyebrow")}</p>
          <h2 id="clarity-title" className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">
            {t.rich("title", { mark: (c) => <Highlighter className="[--hl-fg:var(--color-ink)]">{c}</Highlighter> })}
          </h2>
          <p className="text-lg text-bone/70">{t("body")}</p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="relative rounded-3xl border border-white/10 bg-ink-2 p-6 sm:p-8">
            <DemoTag className="absolute end-5 top-5 border-white/30 bg-transparent text-bone/60" />
            <p className="text-sm text-bone/60">{t("monthLabel")}</p>
            <p className="num mt-1 text-4xl font-semibold sm:text-5xl" dir="ltr">{t("monthTotal")}</p>
            <motion.ul
              className="mt-8 space-y-4"
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.4 }}
            >
              {bars.map((b, i) => (
                <li key={b.label} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span>{b.label}</span>
                    <span className="num text-bone/70" dir="ltr">{b.amount}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
                    <motion.div
                      className="h-full origin-left rounded-full rtl:origin-right"
                      style={{ width: `${(b.value / max) * 100}%`, background: `var(--color-${["lime", "bone", "lime-deep", "bone"][i % 4]})`, opacity: i % 2 ? 0.55 : 1 }}
                      variants={{
                        hidden: { scaleX: 0 },
                        show: { scaleX: 1, transition: { duration: 0.9, delay: i * 0.12, ease: ease.out } },
                      }}
                    />
                  </div>
                </li>
              ))}
            </motion.ul>
          </div>

          <div className="relative flex flex-col justify-end gap-4 rounded-3xl border border-white/10 bg-ink-2 p-6 sm:p-8">
            <DemoTag className="absolute end-5 top-5 border-white/30 bg-transparent text-bone/60" />
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.8 }}
              transition={{ duration: 0.4 }}
              className="ms-auto max-w-[85%] rounded-3xl rounded-ee-md bg-lime px-4 py-3 text-ink"
            >
              {t("question")}
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.8 }}
              transition={{ duration: 0.4, delay: 0.7 }}
              className="flex gap-3"
            >
              <LogoMark className="mt-1 size-9 shrink-0 text-bone" />
              <div className="space-y-1.5">
                <div className="rounded-3xl rounded-ss-md bg-bone/10 px-4 py-3 leading-relaxed">
                  {t.rich("answer", {
                    amt: (c) => (
                      <code dir="ltr" className="rounded-md bg-lime/20 px-1.5 py-0.5 font-mono text-[0.92em] text-lime">
                        {c}
                      </code>
                    ),
                  })}
                </div>
                <p className="flex items-center gap-1.5 px-2 text-[11px] text-bone/50">
                  <Sparkles className="size-3" aria-hidden />
                  {t("aiNote")}
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
