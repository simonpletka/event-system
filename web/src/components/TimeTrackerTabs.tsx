"use client";

import { usePathname } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/dictionary";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";

export function TimeTrackerTabs({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const t = getDictionary(locale).timeTracker;
  const tabs = [
    { value: "tracking", href: "/time-tracker/tracking", label: t.tabTracking },
    { value: "report", href: "/time-tracker/report", label: t.tabReport },
  ];
  const active = tabs.find((tab) => pathname.startsWith(tab.href))?.value ?? "tracking";

  return <SegmentedTabs options={tabs} active={active} />;
}
