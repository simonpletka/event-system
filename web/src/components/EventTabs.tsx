"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function EventTabs({
  eventId,
  counts,
}: {
  eventId: string;
  counts: { expenses: number; time: string; docs: number };
}) {
  const pathname = usePathname();
  const base = `/events/${eventId}`;
  const tabs = [
    { href: base, label: "Overview", exact: true },
    { href: `${base}/milestones`, label: "Milestones" },
    { href: `${base}/expenses`, label: `Expenses ${counts.expenses}` },
    { href: `${base}/time`, label: `Time ${counts.time}` },
    { href: `${base}/quotes`, label: `Quotes & invoices ${counts.docs}` },
    { href: `${base}/files`, label: "Files" },
  ];

  return (
    <div className="flex gap-3.5 mt-2.5 border-b border-ink/20 flex-wrap">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`text-[9px] tracking-[0.14em] uppercase pb-1.5 border-b-2 ${
              active ? "border-accent text-accent" : "border-transparent placeholder-text hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
