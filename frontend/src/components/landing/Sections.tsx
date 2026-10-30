"use client";

import { useTranslations } from "next-intl";
import {
  Check,
  Coins,
  Download,
  FileSearch,
  Languages,
  LockKeyhole,
  ScanSearch,
  ShieldCheck,
  Trash2,
  UserRoundCheck,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { Reveal, RevealItem } from "@/components/common/Reveal";
import { Highlighter } from "@/components/common/Highlighter";
import { Logo } from "@/components/brand/Logo";
import { LanguageSwitcher } from "@/components/common/Toggles";
import { Wara } from "@/components/illustrations/Wara";
import { WalletParty } from "@/components/illustrations/Scenes";
import { Accordion, AccordionItem, AccordionPanel, AccordionTrigger } from "@/components/ui/accordion";
import { buttonVariants } from "@/components/ui/button";
import { PLANS } from "@/lib/plans";
import { cn } from "@/lib/utils";

function SectionTitle({ eyebrow, title, body, center = false }: { eyebrow: string; title: React.ReactNode; body?: string; center?: boolean }) {
  return (
    <div className={cn("max-w-2xl space-y-4", center && "mx-auto text-center")}>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
      <h2 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">{title}</h2>
      {body && <p className="text-lg text-muted-foreground">{body}</p>}
    </div>
  );
}

export function Features() {
  const t = useTranslations("landing.features");
  const cards = [
    { key: "currency", icon: Coins, span: "lg:col-span-2", accent: true },
    { key: "review", icon: ScanSearch, span: "" },
    { key: "chat", icon: Languages, span: "" },
    { key: "search", icon: FileSearch, span: "" },
    { key: "yours", icon: UserRoundCheck, span: "" },
  ] as const;
  return (
    <section id="features" className="scroll-mt-20 bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-7xl space-y-14 px-5 sm:px-8">
        <SectionTitle eyebrow={t("eyebrow")} title={t.rich("title", { mark: (c) => <Highlighter>{c}</Highlighter> })} body={t("body")} />
        <Reveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ key, icon: Icon, span, ...rest }) => {
            const accent = "accent" in rest;
            return (
              <RevealItem
                key={key}
                as="article"
                className={cn(
                  "group relative overflow-hidden rounded-3xl border p-7 transition-transform duration-300 hover:-translate-y-1",
                  accent ? "border-transparent bg-lime text-ink" : "border-border bg-card shadow-paper",
                  span,
                )}
              >
                <span className={cn("mb-10 grid size-12 place-items-center rounded-2xl", accent ? "bg-ink text-lime" : "bg-muted")}>
                  <Icon className="size-6" strokeWidth={1.75} aria-hidden />
                </span>
                <h3 className="font-heading text-xl font-semibold">{t(`cards.${key}.title`)}</h3>
                <p className={cn("mt-2", accent ? "text-ink/75" : "text-muted-foreground")}>{t(`cards.${key}.body`)}</p>
                {accent && (
                  <div className="mt-6 flex flex-wrap gap-2" aria-hidden>
                    {["EGP", "SAR", "USD"].map((c) => (
                      <span key={c} className="rounded-full bg-ink px-3 py-1 font-mono text-xs font-semibold text-lime">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </RevealItem>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}

export function Privacy() {
  const t = useTranslations("landing.privacy");
  const facts = [
    { key: "isolated", icon: LockKeyhole },
    { key: "export", icon: Download },
    { key: "delete", icon: Trash2 },
  ] as const;
  return (
    <section className="border-y border-border bg-card py-16">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="flex items-center gap-5">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-ink text-lime">
            <ShieldCheck className="size-7" aria-hidden />
          </span>
          <div>
            <h2 className="font-heading text-2xl font-bold">{t("title")}</h2>
            <p className="text-muted-foreground">{t("body")}</p>
          </div>
        </div>
        <ul className="grid gap-6 sm:grid-cols-3">
          {facts.map(({ key, icon: Icon }) => (
            <li key={key} className="space-y-2">
              <Icon className="size-5 text-brand-text" aria-hidden />
              <p className="font-semibold">{t(`facts.${key}.title`)}</p>
              <p className="text-sm text-muted-foreground">{t(`facts.${key}.body`)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Pricing() {
  const t = useTranslations("landing.pricing");
  const { isAuthenticated } = useAuth();
  const features = ["all", "currencies", "export"] as const;
  return (
    <section id="pricing" className="scroll-mt-20 bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-5xl space-y-14 px-5 sm:px-8">
        <SectionTitle center eyebrow={t("eyebrow")} title={t("title")} body={t("body")} />
        <div className="grid gap-6 md:grid-cols-2">
          {/* Free */}
          <article className="relative flex flex-col rounded-3xl bg-ink p-8 text-bone shadow-lift">
            <WalletParty className="absolute end-6 top-6 w-16 text-bone" />
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-lime">{t("free.name")}</p>
            <p className="mt-4 font-heading text-5xl font-bold">{t("free.price")}</p>
            <p className="mt-2 text-bone/65">{t("free.note")}</p>
            <ul className="my-8 space-y-3">
              <li className="flex items-center gap-3"><Check className="size-4 text-lime" aria-hidden />{t("limits.receipts", { n: PLANS.free.receipts.toLocaleString("en-US") })}</li>
              <li className="flex items-center gap-3"><Check className="size-4 text-lime" aria-hidden />{t("limits.chat", { n: PLANS.free.chat.toLocaleString("en-US") })}</li>
              {features.map((f) => (
                <li key={f} className="flex items-center gap-3"><Check className="size-4 text-lime" aria-hidden />{t(`features.${f}`)}</li>
              ))}
            </ul>
            <Link href={isAuthenticated ? "/dashboard" : "/register"} className={buttonVariants({ size: "lg", className: "mt-auto w-full" })}>
              {isAuthenticated ? t("free.ctaApp") : t("free.cta")}
            </Link>
          </article>
          {/* Pro */}
          <article className="flex flex-col rounded-3xl border-2 border-dashed border-border bg-card p-8">
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("pro.name")}</p>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{t("pro.soon")}</span>
            </div>
            <p className="mt-4 font-heading text-5xl font-bold text-muted-foreground">—</p>
            <p className="mt-2 text-muted-foreground">{t("pro.note")}</p>
            <ul className="my-8 space-y-3 text-muted-foreground">
              <li className="flex items-center gap-3"><Check className="size-4" aria-hidden />{t("limits.receipts", { n: PLANS.pro.receipts.toLocaleString("en-US") })}</li>
              <li className="flex items-center gap-3"><Check className="size-4" aria-hidden />{t("limits.chat", { n: PLANS.pro.chat.toLocaleString("en-US") })}</li>
              {features.map((f) => (
                <li key={f} className="flex items-center gap-3"><Check className="size-4" aria-hidden />{t(`features.${f}`)}</li>
              ))}
            </ul>
            <p className="mt-auto rounded-2xl bg-muted px-4 py-3 text-center text-sm text-muted-foreground">{t("pro.waitNote")}</p>
          </article>
        </div>
      </div>
    </section>
  );
}

export function Faq() {
  const t = useTranslations("landing.faq");
  const keys = ["free", "formats", "accuracy", "privacy", "currencies", "language"] as const;
  return (
    <section id="faq" className="scroll-mt-20 bg-background pb-24 sm:pb-32">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-6">
          <SectionTitle eyebrow={t("eyebrow")} title={t("title")} />
          <Wara pose="squint" className="hidden w-32 text-ink lg:block dark:text-bone" />
        </div>
        <Accordion>
          {keys.map((k) => (
            <AccordionItem key={k} value={k}>
              <AccordionTrigger>{t(`items.${k}.q`)}</AccordionTrigger>
              <AccordionPanel>{t(`items.${k}.a`)}</AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

export function CtaBand() {
  const t = useTranslations("landing.cta");
  const { isAuthenticated } = useAuth();
  return (
    <section className="px-4 pb-6 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 overflow-hidden rounded-[40px] bg-lime px-6 py-14 text-center text-ink sm:px-12 lg:flex-row lg:text-start">
        <Wara pose="party" className="w-36 shrink-0 text-ink sm:w-44" />
        <div className="flex-1 space-y-3">
          <h2 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">{t("title")}</h2>
          <p className="text-lg text-ink/75">{t("body")}</p>
        </div>
        <Link
          href={isAuthenticated ? "/dashboard" : "/register"}
          className={buttonVariants({ variant: "ink", size: "lg", className: "px-8" })}
        >
          {isAuthenticated ? t("ctaApp") : t("cta")}
        </Link>
      </div>
    </section>
  );
}

export function Footer() {
  const t = useTranslations("landing.footer");
  return (
    <footer className="bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-12 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Logo className="text-base" markClassName="size-9 text-ink dark:text-bone" />
          <p className="max-w-xs text-sm text-muted-foreground">{t("tagline")}</p>
        </div>
        <nav aria-label={t("label")} className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <a href="#how" className="text-muted-foreground hover:text-foreground">{t("how")}</a>
          <a href="#pricing" className="text-muted-foreground hover:text-foreground">{t("pricing")}</a>
          <Link href="/login" className="text-muted-foreground hover:text-foreground">{t("login")}</Link>
          <Link href="/register" className="text-muted-foreground hover:text-foreground">{t("register")}</Link>
          <LanguageSwitcher />
        </nav>
      </div>
      <div className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        {t("copyright", { year: String(new Date().getFullYear()) })}
      </div>
    </footer>
  );
}
