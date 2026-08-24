"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/lib/actions/auth";
import { TimerWidget } from "@/components/TimerWidget";
import type { Dictionary } from "@/lib/dictionary";

export function Sidebar({
  userName,
  avatarUrl,
  running,
  events,
  tNav,
  tSidebar,
  tElapsed,
  discardedMessage,
}: {
  userName: string;
  avatarUrl: string | null;
  running: { eventId: string | null; eventTitle: string | null; startedAt: string } | null;
  events: { id: string; title: string }[];
  tNav: Dictionary["nav"];
  tSidebar: Dictionary["sidebar"];
  tElapsed: Dictionary["timeTracker"]["editableElapsed"];
  discardedMessage: string;
}) {
  const pathname = usePathname();

  const NAV = [
    { href: "/dashboard", label: tNav.dashboard },
    { href: "/clients", label: tNav.clients },
    { href: "/events", label: tNav.events },
    { href: "/finance", label: tNav.finance },
    { href: "/time-tracker", label: tNav.timeTracker },
  ];

  return (
    <div className="hidden md:flex sticky top-3 h-[calc(100vh-24px)] ml-3 shrink-0 glass-panel rounded-2xl shadow-[0_14px_36px_rgba(0,0,0,0.4)] w-[216px] px-4 pt-4 pb-5 flex-col gap-4 print-hide font-medium overflow-y-auto">
      <span className="text-[11px] font-bold tracking-[0.16em]">EVENT SYSTEM</span>

      <nav className="flex flex-col">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={`nav-item ${active ? "active" : ""}`}>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="rule-thin" />

      <TimerWidget running={running} events={events} t={tSidebar} tElapsed={tElapsed} discardedMessage={discardedMessage} />

      <div className="mt-auto flex flex-col gap-2.5">
        <Link href="/settings" className={`nav-item ${pathname.startsWith("/settings") ? "active" : ""}`}>
          {tNav.settings}
        </Link>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- authenticated route, not a static asset next/image can optimize
              <img src={avatarUrl} alt="" className="w-5 h-5 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="w-5 h-5 shrink-0 bg-ink/10" />
            )}
            <span className="text-[10px] truncate">{userName}</span>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="cursor-pointer text-[9px] tracking-[0.1em] uppercase placeholder-text hover:text-ink">
              {tNav.signOut}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
