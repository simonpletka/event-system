"use client";

import { useEffect } from "react";
import Link from "next/link";
import { getDictionary, type Locale } from "@/lib/dictionary";

// App-section error boundary. Keeps the shell (from (app)/layout) and offers
// a retry plus a way out, instead of a blank screen.
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const lang = typeof document !== "undefined" ? document.documentElement.lang : "en";
  const t = getDictionary((lang === "cs" ? "cs" : "en") as Locale).common;

  return (
    <div className="flex items-center justify-center py-20 px-6">
      <div className="card max-w-md w-full px-7 py-8 text-center">
        <div className="heading-label !text-[12px] font-bold text-warning">!</div>
        <h1 className="text-[22px] font-semibold tracking-tight mt-2">{t.errorTitle}</h1>
        <p className="text-sm placeholder-text mt-2 leading-relaxed">{t.errorBody}</p>
        {error.digest && <p className="text-[10px] placeholder-text mt-2 font-mono">ref: {error.digest}</p>}
        <div className="flex gap-2 justify-center mt-6">
          <button type="button" onClick={() => retry()} className="btn font-semibold">
            {t.tryAgain}
          </button>
          <Link href="/dashboard" className="btno">
            {t.backToDashboard}
          </Link>
        </div>
      </div>
    </div>
  );
}
