import Link from "next/link";
import { getLocale, getDictionary } from "@/lib/i18n";

// In-app 404 — reached when a page calls notFound() (e.g. an event id that
// doesn't exist or the viewer can't see). Renders inside (app)/layout, so
// the sidebar and shell stay in place.
export default async function AppNotFound() {
  const t = getDictionary(await getLocale()).common;

  return (
    <div className="flex items-center justify-center py-20 px-6">
      <div className="card max-w-md w-full px-7 py-8 text-center">
        <div className="heading-label !text-[12px] font-bold">404</div>
        <h1 className="text-[22px] font-semibold tracking-tight mt-2">{t.pageNotFoundTitle}</h1>
        <p className="text-sm placeholder-text mt-2 leading-relaxed">{t.pageNotFoundBody}</p>
        <Link href="/dashboard" className="btn font-semibold inline-block mt-6">
          {t.backToDashboard}
        </Link>
      </div>
    </div>
  );
}
