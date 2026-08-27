import Link from "next/link";
import { getLocale, getDictionary } from "@/lib/i18n";

// Root-level 404 — also the fallback for any URL that matches no route.
// Renders inside the root layout only (no sidebar), so it works whether or
// not the visitor is signed in.
export default async function NotFound() {
  const t = getDictionary(await getLocale()).common;

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="card max-w-md w-full px-7 py-8 text-center">
        <div className="heading-label !text-[12px] font-bold">404</div>
        <h1 className="text-[22px] font-semibold tracking-tight mt-2">{t.pageNotFoundTitle}</h1>
        <p className="text-sm placeholder-text mt-2 leading-relaxed">{t.pageNotFoundBody}</p>
        <Link href="/dashboard" className="btn font-semibold inline-block mt-6">
          {t.backToDashboard}
        </Link>
      </div>
    </main>
  );
}
