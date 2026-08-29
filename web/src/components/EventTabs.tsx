"use client";

import { usePathname } from "next/navigation";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { getDictionary, type Locale } from "@/lib/dictionary";

export function EventTabs({
  eventId,
  showFinance,
  locale,
}: {
  eventId: string;
  showFinance: boolean;
  locale: Locale;
}) {
  const t = getDictionary(locale).events;
  const pathname = usePathname();
  const base = `/events/${eventId}`;
  const tabs = [
    { value: "overview", href: base, label: t.tabOverview },
    { value: "roadmap", href: `${base}/roadmap`, label: t.tabRoadmap },
    ...(showFinance ? [{ value: "finance", href: `${base}/finance`, label: t.tabFinance }] : []),
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
