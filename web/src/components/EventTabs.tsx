"use client";

import { usePathname } from "next/navigation";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
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
    { value: "overview", href: base, label: t.tabOverview },
    { value: "milestones", href: `${base}/milestones`, label: t.tabMilestones },
    { value: "expenses", href: `${base}/expenses`, label: t.tabExpenses(counts.expenses) },
    { value: "time", href: `${base}/time`, label: t.tabTime(counts.time) },
    { value: "quotes", href: `${base}/quotes`, label: t.tabQuotesInvoices(counts.docs) },
    { value: "files", href: `${base}/files`, label: t.tabFiles },
  ];
  const seg = pathname.slice(base.length).split("/")[1] || "overview";
  const active = tabs.some((x) => x.value === seg) ? seg : "overview";

  return (
    <div className="mt-2.5 -mx-6 px-6 overflow-x-auto md:mx-0 md:px-0 md:overflow-visible">
      <SegmentedTabs options={tabs} active={active} />
    </div>
  );
}
