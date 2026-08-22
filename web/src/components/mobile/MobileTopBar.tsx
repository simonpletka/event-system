"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/lib/actions/auth";
import { TimerWidget } from "@/components/TimerWidget";
import type { Dictionary } from "@/lib/dictionary";

export function MobileTopBar({
  userName,
  running,
  tNav,
  tSidebar,
}: {
  userName: string;
  running: { eventTitle: string; startedAt: string } | null;
  tNav: Dictionary["nav"];
  tSidebar: Dictionary["sidebar"];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className="md:hidden -mx-6 -mt-5 mb-3 px-6 py-3 flex items-center justify-between print-hide"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <span className="text-[10px] font-bold tracking-[0.14em]">EVENT SYSTEM</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={tNav.settings}
          className="w-7 h-7 rounded-full bg-ink/10 border border-ink/18 flex items-center justify-center text-ink/70"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8.3" r="3.8" />
            <path d="M4.3 20.4c0-4.1 3.4-6.6 7.7-6.6s7.7 2.5 7.7 6.6" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="md:hidden fixed inset-0 z-40 print-hide">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-bg/70"
          />
          <div
            className="absolute left-0 right-0 bottom-0 glass-panel rounded-t-[22px] border-b-0 shadow-[0_-14px_36px_rgba(0,0,0,0.5)] px-4 pt-2.5 pb-6"
            style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
          >
            <div className="w-9 h-1 rounded-full bg-ink/20 mx-auto mb-4" />

            <div className="flex items-center gap-3 pb-4 mb-2.5 border-b border-ink/10">
              <div className="w-11 h-11 rounded-full bg-ink/10 border border-ink/18 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink/70">
                  <circle cx="12" cy="8.3" r="3.8" />
                  <path d="M4.3 20.4c0-4.1 3.4-6.6 7.7-6.6s7.7 2.5 7.7 6.6" />
                </svg>
              </div>
              <span className="text-[14.5px] font-semibold truncate">{userName}</span>
            </div>

            <div className="mb-2.5">
              <TimerWidget running={running} t={tSidebar} />
            </div>

            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className={`nav-item block !text-[13px] !py-3 !px-1 ${pathname.startsWith("/settings") ? "active" : ""}`}
            >
              {tNav.settings}
            </Link>

            <div className="rule-thin my-1" />

            <form action={signOutAction}>
              <button
                type="submit"
                className="w-full text-left py-3 px-1 text-[13px] text-warning"
              >
                {tNav.signOut}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
