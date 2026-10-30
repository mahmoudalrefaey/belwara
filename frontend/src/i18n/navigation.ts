import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/** Locale-aware Link / router: `href="/receipts"` keeps the current language. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
