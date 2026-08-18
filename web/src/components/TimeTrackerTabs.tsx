"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function TimeTrackerTabs() {
  const pathname = usePathname();
  const tabs = [
    { href: "/time-tracker/tracking", label: "Tracking" },
    { href: "/time-tracker/overview", label: "Overview" },
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
