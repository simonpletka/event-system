"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/dictionary";

export function TimeTrackerTabs({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const t = getDictionary(locale).timeTracker;
  const tabs = [
    { href: "/time-tracker/tracking", label: t.tabTracking },
    { href: "/time-tracker/overview", label: t.tabOverview },
  ];

  return (
    <div className="flex gap-3.5">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} className={`nav-item ${active ? "active" : ""}`}>
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
