"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOutAction } from "@/lib/actions/auth";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/events", label: "Events" },
  { href: "/finance", label: "Finance" },
  { href: "/time-tracker", label: "Time tracker" },
] as const;

export function Sidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div className="w-10 shrink-0 border-r-2 border-ink flex flex-col items-center py-4">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="btno px-1.5 py-1"
          title="Expand sidebar"
        >
          »
        </button>
      </div>
    );
  }

  return (
    <div className="w-[190px] shrink-0 border-r-2 border-ink px-4 pt-4 pb-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold tracking-[0.16em]">EVENT SYSTEM</span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="btno px-1.5 py-1"
          title="Collapse sidebar"
        >
          «
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

      <div>
        <div className="heading-label mb-1.5">My timer</div>
        <div className="text-sm placeholder-text">No timer running</div>
        <div className="text-[10px] placeholder-text mt-1">Time tracker lands in a later phase</div>
      </div>

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
