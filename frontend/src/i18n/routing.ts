import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  // Arabic for everyone by default; English only when the user picks it (or opens an /en link).
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
