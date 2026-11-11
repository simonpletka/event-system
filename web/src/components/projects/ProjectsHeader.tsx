"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { SlidingTabs } from "@/components/ui/SlidingTabs";
import { getDictionary, type Locale } from "@/lib/dictionary";

/** The Projects title row. Only the list has it: a project's own pages have their own header. */
export function ProjectsHeader({ canCreate, locale }: { canCreate: boolean; locale: Locale }) {
  const t = getDictionary(locale).projects;
  const pathname = usePathname();
  const view = useSearchParams().get("view") === "calendar" ? "calendar" : "table";
  if (pathname !== "/projects") return null;

  return (
    <PageHeader>
      <div className="max-w-[1080px] flex items-end justify-between gap-3 flex-wrap">
        <h1 className="text-[48px] font-bold tracking-tight">{t.title}</h1>
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <SlidingTabs
            active={view}
            tabs={[
              { value: "table", href: "/projects", label: t.viewTable },
              { value: "calendar", href: "/projects?view=calendar", label: t.viewCalendar },
            ]}
          />
          {canCreate && (
            <Link href="/projects/new" className="btn font-semibold">
              {t.newProject}
            </Link>
          )}
        </div>
      </div>
    </PageHeader>
  );
}
