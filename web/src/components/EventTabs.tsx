"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/dictionary";

export function EventTabs({
  eventId,
  counts,
  locale,
}: {
  eventId: string;
  counts: { expenses: number; time: string; docs: number };
  locale: Locale;
}) {
  const t = getDictionary(locale).events;
  const pathname = usePathname();
  const base = `/events/${eventId}`;
  const tabs = [
    { href: base, label: t.tabOverview, exact: true },
    { href: `${base}/milestones`, label: t.tabMilestones },
    { href: `${base}/expenses`, label: t.tabExpenses(counts.expenses) },
    { href: `${base}/time`, label: t.tabTime(counts.time) },
    { href: `${base}/quotes`, label: t.tabQuotesInvoices(counts.docs) },
    { href: `${base}/files`, label: t.tabFiles },
  ];

  return (
    <div className="flex gap-3.5 mt-2.5 border-b border-ink/20 flex-nowrap overflow-x-auto md:flex-wrap md:overflow-visible">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`shrink-0 text-[9px] tracking-[0.14em] uppercase pb-1.5 border-b-2 ${
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
