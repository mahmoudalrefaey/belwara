import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Wara } from "@/components/illustrations/Wara";
import { buttonVariants } from "@/components/ui/button-variants";

export default async function NotFound() {
  const t = await getTranslations("errors.notFound");
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <p className="num text-7xl font-semibold text-muted-foreground/40" aria-hidden>
          404
        </p>
        <Wara pose="crumpled" className="w-36 text-ink dark:text-bone" />
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("body")}</p>
        </div>
        <Link href="/" className={buttonVariants({ size: "lg" })}>
          {t("home")}
        </Link>
      </div>
    </main>
  );
}
