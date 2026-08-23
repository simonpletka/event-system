import { auth } from "@/auth";
import { getFreshUserFields } from "@/lib/authz";
import { getCompanySettings } from "@/lib/queries/finance";
import type { Locale } from "@/lib/dictionary";

// Server-only entry point: getLocale() reads CompanySettings/User via Prisma, so
// this file must never be imported from a Client Component (it would pull the DB
// layer into the browser bundle). Client components should import
// getDictionary/Locale/Dictionary/czCount directly from "@/lib/dictionary"
// instead. Server Components/Server Actions can keep using this file, which
// re-exports everything from dictionary.ts for convenience.
export * from "@/lib/dictionary";

/**
 * Per-account override (Settings → General) wins when set; otherwise falls
 * back to the company-wide default (Settings → App settings) — same
 * "personal choice over shared default" shape as an OS's own language
 * setting. No session param needed: reads the current request's session
 * directly, so every existing zero-arg call site (~40 of them, across
 * nearly every page) keeps working unchanged. On the login page (no
 * session yet) this just falls through to the company default.
 */
export async function getLocale(): Promise<Locale> {
  const session = await auth();
  if (session?.user?.id) {
    const fresh = await getFreshUserFields(session.user.id);
    if (fresh?.locale === "cs" || fresh?.locale === "en") return fresh.locale;
  }
  const company = await getCompanySettings();
  return company?.locale === "cs" ? "cs" : "en";
}
