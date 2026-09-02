"use client";

import { usePathname } from "next/navigation";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { projectHref } from "@/lib/slug";
import { getDictionary, type Locale } from "@/lib/dictionary";

export function ProjectTabs({
  project,
  showFinance,
  locale,
}: {
  project: { number: string; title: string };
  showFinance: boolean;
  locale: Locale;
}) {
  const t = getDictionary(locale).projects;
  const pathname = usePathname();
  const base = projectHref(project);
  const tabs = [
    { value: "overview", href: base, label: t.tabOverview },
    { value: "roadmap", href: `${base}/roadmap`, label: t.tabRoadmap },
    ...(showFinance ? [{ value: "finance", href: `${base}/finance`, label: t.tabFinance }] : []),
    { value: "files", href: `${base}/files`, label: t.tabFiles },
  ];
  const seg = pathname.slice(base.length).split("/")[1] || "overview";
  const active = tabs.some((x) => x.value === seg) ? seg : "overview";

  return <SegmentedTabs options={tabs} active={active} />;
}
