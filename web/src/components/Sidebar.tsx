"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOutAction } from "@/lib/actions/auth";
import { TimerWidget } from "@/components/TimerWidget";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
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
  const [pinned, setPinned] = useState(true);
  const [hovering, setHovering] = useState(false);
  const visible = pinned || hovering;

  return (
    <>
      {!pinned && (
        // Invisible hot zone along the left edge — hovering it slides the sidebar into view.
        <div
          className="fixed inset-y-0 left-0 w-3 z-40 print-hide"
          onMouseEnter={() => setHovering(true)}
        />
      )}
      <div
        className={`${pinned ? "shrink-0" : "fixed inset-y-0 left-0 z-50"} w-[190px] border-r-2 border-ink bg-bg px-4 pt-4 pb-5 flex flex-col gap-4 print-hide font-medium transition-transform duration-[240ms] ease-out ${
          visible ? "translate-x-0" : "-translate-x-full"
        }`}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold tracking-[0.16em]">EVENT SYSTEM</span>
          <button
            type="button"
            onClick={() => setPinned((p) => !p)}
            className="btno px-1.5 py-1"
            title={pinned ? "Unpin sidebar" : "Pin sidebar"}
          >
            {pinned ? "«" : "»"}
          </button>
        </div>

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
    </>
  );
}
