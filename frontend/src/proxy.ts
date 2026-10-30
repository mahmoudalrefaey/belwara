import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip the /api proxy to FastAPI, Next internals and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\..*).*)",
};
