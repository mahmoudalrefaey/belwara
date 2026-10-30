"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Field, PasswordField } from "@/components/auth/AuthFields";
import { useMascot } from "@/components/auth/MascotContext";
import { authErrorKey } from "@/components/auth/authErrors";
import { useAuth } from "@/providers/AuthProvider";

export default function LoginPage() {
  const t = useTranslations("auth");
  const setPose = useMascot();
  const { login } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const schema = z.object({
    email: z.string().min(1, t("validation.emailRequired")).email(t("validation.emailInvalid")),
    password: z.string().min(1, t("validation.passwordRequired")),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(
    async (data) => {
      setFormError(null);
      setPose("reading");
      try {
        await login(data.email, data.password);
        setPose("party");
      } catch (err) {
        setPose("squint");
        setFormError(t(`errors.${authErrorKey(err, "login")}`));
      }
    },
    () => setPose("squint"),
  );

  const password = register("password");

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight">{t("login.title")}</h1>
        <p className="text-muted-foreground">{t("login.subtitle")}</p>
      </div>

      <form className="space-y-5" onSubmit={onSubmit} noValidate>
        {formError && (
          <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {formError}
          </div>
        )}
        <Field
          id="login-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          label={t("fields.email")}
          error={errors.email?.message}
          {...register("email")}
        />
        <PasswordField
          id="login-password"
          autoComplete="current-password"
          label={t("fields.password")}
          error={errors.password?.message}
          {...password}
          onFocus={() => setPose("shy")}
          onBlur={(e) => {
            setPose("hello");
            void password.onBlur(e);
          }}
        />
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {isSubmitting ? t("login.submitting") : t("login.submit")}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t("login.noAccount")}{" "}
        <Link href="/register" className="font-semibold text-foreground underline decoration-lime decoration-[3px] underline-offset-4 hover:decoration-foreground">
          {t("login.toRegister")}
        </Link>
      </p>

      <Link href="/" className="mx-auto flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t("backHome")}
      </Link>
    </div>
  );
}
