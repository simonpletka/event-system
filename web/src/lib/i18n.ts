import { getCompanySettings } from "@/lib/queries/finance";
import type { Locale } from "@/lib/dictionary";

// Server-only entry point: getLocale() reads CompanySettings via Prisma, so this
// file must never be imported from a Client Component (it would pull the DB
// layer into the browser bundle). Client components should import
// getDictionary/Locale/Dictionary/czCount directly from "@/lib/dictionary"
// instead. Server Components/Server Actions can keep using this file, which
// re-exports everything from dictionary.ts for convenience.
export * from "@/lib/dictionary";

export async function getLocale(): Promise<Locale> {
  const company = await getCompanySettings();
  return company?.locale === "cs" ? "cs" : "en";
}
