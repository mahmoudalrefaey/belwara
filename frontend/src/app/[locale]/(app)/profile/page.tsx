"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Download, Loader2, LogOut, Trash2 } from "lucide-react";
import { downloadMyData, useDeleteAccount, useUsage, useUser } from "@/hooks/useUser";
import { useAuth } from "@/providers/AuthProvider";
import { PageHeader } from "@/components/common/PageHeader";
import { Meter } from "@/components/common/Meter";
import { EmptyState } from "@/components/common/EmptyState";
import { LanguageSwitcher, ThemeSwitch } from "@/components/common/Toggles";
import { initialsOf } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getPrefs, setPrefs } from "@/lib/prefs";
import { useFormat } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { UserPrefs } from "@/types/api";

type Currency = UserPrefs["defaultCurrency"];
const CURRENCIES: Currency[] = ["EGP", "SAR", "USD"];

function Section({
  id,
  title,
  description,
  children,
  className,
}: {
  id?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className={cn("scroll-mt-24 rounded-3xl border border-border/70 bg-card p-5 shadow-paper sm:p-7", className)}
    >
      <div className="mb-5 space-y-1">
        <h2 id={id ? `${id}-title` : undefined} className="font-heading text-lg font-semibold">
          {title}
        </h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-dashed py-4 first:border-t-0 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-medium">{label}</span>
      <div>{children}</div>
    </div>
  );
}

export default function ProfilePage() {
  const t = useTranslations("profile");
  const f = useFormat();
  const { logout } = useAuth();
  const { data: user, isLoading } = useUser();
  const { data: usage } = useUsage();
  const { mutateAsync: deleteAccount, isPending: deleting } = useDeleteAccount();
  const [currency, setCurrency] = useState<Currency>("EGP");
  const [exporting, setExporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setCurrency(getPrefs().defaultCurrency);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-56 rounded-3xl" />
      </div>
    );
  }

  if (!user) {
    return <EmptyState pose="crumpled" title={t("loadFailed")} />;
  }

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadMyData();
      toast.success(t("data.exported"));
    } catch {
      toast.error(t("data.exportFailed"));
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    setDeleteError(null);
    try {
      await deleteAccount(password);
      toast.success(t("danger.deleted"));
      logout();
    } catch {
      setDeleteError(t("danger.wrongPassword"));
    }
  };

  const planName = t(usage?.plan === "pro" ? "plan.pro" : "plan.free");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("subtitle")} />

      {/* Identity card */}
      <section className="flex flex-col gap-5 overflow-hidden rounded-3xl bg-ink p-6 text-bone shadow-lift sm:flex-row sm:items-center sm:p-8 dark:bg-ink-2 dark:ring-1 dark:ring-inset dark:ring-white/10">
        <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-lime font-heading text-2xl font-bold text-ink">
          {initialsOf(user.full_name, user.email)}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate font-heading text-2xl font-bold">{user.full_name?.trim() || t("noName")}</p>
          <p className="truncate text-bone/70">{user.email}</p>
          <p className="text-sm text-bone/50">{t("memberSince", { date: f.date(user.created_at) })}</p>
        </div>
        <span className="self-start rounded-full border border-white/15 px-3 py-1 font-mono text-xs uppercase tracking-wider text-lime sm:self-center">
          {planName}
        </span>
      </section>

      <Section id="usage" title={t("plan.title")} description={t("plan.subtitle", { plan: planName })}>
        {usage ? (
          <div className="space-y-5">
            {(["receipts", "chat"] as const).map((k) => {
              const u = usage[k];
              return (
                <div key={k} className="space-y-2">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{t(`plan.${k}`)}</span>
                    <span className="num text-muted-foreground">
                      {u.limit ? t("plan.of", { used: String(u.used), limit: String(u.limit) }) : t("plan.unlimited", { used: String(u.used) })}
                    </span>
                  </div>
                  {u.limit > 0 && <Meter value={u.used} max={u.limit} label={t(`plan.${k}`)} />}
                  {u.limit > 0 && u.used >= u.limit && (
                    <p className="text-xs text-destructive">{t("plan.reached")}</p>
                  )}
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">{t("plan.resets")}</p>
          </div>
        ) : (
          <Skeleton className="h-20" />
        )}
      </Section>

      <Section title={t("prefs.title")} description={t("prefs.subtitle")}>
        <Row label={t("prefs.language")}>
          <LanguageSwitcher />
        </Row>
        <Row label={t("prefs.theme")}>
          <ThemeSwitch />
        </Row>
        <Row label={t("prefs.currency")}>
          <div role="radiogroup" aria-label={t("prefs.currency")} className="inline-flex rounded-full border border-border bg-card p-0.5">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={currency === c}
                onClick={() => {
                  setCurrency(c);
                  setPrefs({ defaultCurrency: c });
                  toast.success(t("prefs.currencySaved", { currency: c }));
                }}
                className={cn(
                  "h-8 cursor-pointer rounded-full px-3.5 font-mono text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  currency === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </Row>
        {user.phone_number && (
          <Row label={t("phone")}>
            <span className="num text-sm text-muted-foreground" dir="ltr">{user.phone_number}</span>
          </Row>
        )}
      </Section>

      <Section title={t("data.title")} description={t("data.subtitle")}>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {t("data.export")}
          </Button>
          <Button variant="outline" onClick={logout}>
            <LogOut className="size-4 rtl:-scale-x-100" />
            {t("logout")}
          </Button>
        </div>
      </Section>

      <Section
        title={t("danger.title")}
        description={t("danger.subtitle")}
        className="border-destructive/30 bg-destructive/[0.03] shadow-none"
      >
        <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
          <Trash2 className="size-4" />
          {t("danger.delete")}
        </Button>
      </Section>

      <Dialog
        open={confirmOpen}
        onOpenChange={(o) => {
          setConfirmOpen(o);
          if (!o) {
            setPassword("");
            setDeleteError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("danger.confirmTitle")}</DialogTitle>
            <DialogDescription>{t("danger.confirmBody")}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (password) void handleDelete();
            }}
          >
            <Label htmlFor="delete-password">{t("danger.password")}</Label>
            <Input
              id="delete-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!deleteError}
              aria-describedby={deleteError ? "delete-error" : undefined}
            />
            {deleteError && (
              <p id="delete-error" role="alert" className="text-xs text-destructive">
                {deleteError}
              </p>
            )}
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t("danger.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting || !password}>
              {deleting && <Loader2 className="size-4 animate-spin" />}
              {t("danger.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
