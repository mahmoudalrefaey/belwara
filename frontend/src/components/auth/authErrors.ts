import { errorDetail, errorStatus } from "@/lib/api";

/** Map an auth failure to a message key in the `auth.errors` namespace. */
export function authErrorKey(err: unknown, mode: "login" | "register"):
  | "invalid"
  | "inactive"
  | "exists"
  | "rate"
  | "network"
  | "generic" {
  const status = errorStatus(err);
  if (status === 401 || (mode === "login" && status === 400)) return "invalid";
  if (status === 403) return "inactive";
  if (status === 409 || (mode === "register" && /exist|registered/i.test(errorDetail(err) ?? ""))) return "exists";
  if (status === 429) return "rate";
  if (status == null) return "network";
  return "generic";
}
