"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Field, PasswordField } from "@/components/auth/AuthFields";
import { useMascot } from "@/components/auth/MascotContext";
import { authErrorKey } from "@/components/auth/authErrors";
import { useAuth } from "@/providers/AuthProvider";

export default function RegisterPage() {
  const t = useTranslations("auth");
  const setPose = useMascot();
  const { register: registerUser } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const schema = z
    .object({
      fullName: z.string().optional(),
      email: z.string().min(1, t("validation.emailRequired")).email(t("validation.emailInvalid")),
      password: z.string().min(8, t("validation.passwordMin")),
      confirmPassword: z.string().min(1, t("validation.confirmRequired")),
    })
    .refine((d) => d.password === d.confirmPassword, {
      message: t("validation.mismatch"),
      path: ["confirmPassword"],
    });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(
    async (data) => {
      setFormError(null);
      setPose("reading");
      try {
        await registerUser(data.email, data.password, data.fullName?.trim() || undefined);
        setPose("party");
      } catch (err) {
        setPose("squint");
        setFormError(t(`errors.${authErrorKey(err, "register")}`));
      }
    },
    () => setPose("squint"),
  );

  const shy = (field: ReturnType<typeof register>) => ({
    ...field,
    onFocus: () => setPose("shy"),
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      setPose("hello");
      void field.onBlur(e);
    },
  });

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight">{t("register.title")}</h1>
        <p className="text-muted-foreground">{t("register.subtitle")}</p>
      </div>

      <form className="space-y-5" onSubmit={onSubmit} noValidate>
        {formError && (
          <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {formError}
          </div>
        )}
        <Field
          id="reg-name"
          autoComplete="name"
          label={t("fields.name")}
          hint={t("fields.nameHint")}
          {...register("fullName")}
        />
        <Field
          id="reg-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          label={t("fields.email")}
          error={errors.email?.message}
          {...register("email")}
        />
        <PasswordField
          id="reg-password"
          autoComplete="new-password"
          label={t("fields.password")}
          hint={t("fields.passwordHint")}
          error={errors.password?.message}
          {...shy(register("password"))}
        />
        <PasswordField
          id="reg-confirm"
          autoComplete="new-password"
          label={t("fields.confirm")}
          error={errors.confirmPassword?.message}
          {...shy(register("confirmPassword"))}
        />
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {isSubmitting ? t("register.submitting") : t("register.submit")}
        </Button>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-text" aria-hidden />
          {t("register.privacy")}
        </p>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t("register.haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-foreground underline decoration-lime decoration-[3px] underline-offset-4 hover:decoration-foreground">
          {t("register.toLogin")}
        </Link>
      </p>

      <Link href="/" className="mx-auto flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t("backHome")}
      </Link>
    </div>
  );
}
