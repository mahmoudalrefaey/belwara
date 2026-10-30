"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { RotateCw } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Wara } from "@/components/illustrations/Wara";
import { Button, buttonVariants } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors.crash");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <Wara pose="crumpled" className="w-36 text-ink dark:text-bone" />
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("body")}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="lg" onClick={reset}>
            <RotateCw className="size-4" />
            {t("retry")}
          </Button>
          <Link href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>
            {t("home")}
          </Link>
        </div>
      </div>
    </main>
  );
}
