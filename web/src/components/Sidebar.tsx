"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/lib/actions/auth";
import { TimerWidget } from "@/components/TimerWidget";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/events", label: "Events" },
  { href: "/finance", label: "Finance" },
  { href: "/time-tracker", label: "Time tracker" },
] as const;

export function Sidebar({
  userName,
  running,
}: {
  userName: string;
  running: { eventTitle: string; startedAt: string } | null;
}) {
  const pathname = usePathname();

  return (
    <div className="sticky top-3 h-[calc(100vh-24px)] ml-3 shrink-0 glass-panel rounded-2xl shadow-[0_14px_36px_rgba(0,0,0,0.4)] w-[216px] px-4 pt-4 pb-5 flex flex-col gap-4 print-hide font-medium overflow-y-auto">
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

      <TimerWidget running={running} />

      <div className="mt-auto flex flex-col gap-2.5">
        <Link href="/settings" className={`nav-item ${pathname.startsWith("/settings") ? "active" : ""}`}>
          Settings
        </Link>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-5 h-5 shrink-0 bg-ink/10" />
            <span className="text-[10px] truncate">{userName}</span>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="text-[9px] tracking-[0.1em] uppercase placeholder-text hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
