import type { ReactNode } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { DateNav } from "@/components/calendar/DateNav";
import { isoDate } from "@/lib/calendar";

/** Content column width — shared by the header's inner wrapper and the body. */
const COL = "max-w-[1080px]";

/**
 * Shared frame for every role dashboard: a full-bleed glass sticky header
 * (title + optional action), an optional List/Calendar switcher, and a
 * generous vertical rhythm between sections. This is the one place the
 * "more whitespace" baseline is tuned.
 */
export function DashboardShell({
  title,
  action,
  view,
  weekStart,
  weekHrefBase,
  todayLabel,
  listLabel,
  calendarLabel,
  children,
}: {
  title: string;
  action?: ReactNode;
  /** Omit for variants with no calendar (Accountant, Member). */
  view?: "list" | "calendar";
  weekStart?: Date;
  weekHrefBase?: string;
  todayLabel?: string;
  listLabel?: string;
  calendarLabel?: string;
  children: ReactNode;
}) {
  const showSwitcher = view !== undefined;

  return (
    <>
      <PageHeader>
        <div className={COL}>
          <div className="flex items-end justify-between gap-3">
            <h1 className="text-[28px] font-bold tracking-tight">{title}</h1>
            {action}
          </div>

          {showSwitcher && (
            <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
              <SegmentedTabs
                active={view}
                options={[
                  { value: "list", label: listLabel ?? "List", href: weekHrefBase ?? "/dashboard" },
                  {
                    value: "calendar",
                    label: calendarLabel ?? "Calendar",
                    href: `${weekHrefBase ?? "/dashboard"}?view=calendar`,
                  },
                ]}
              />
              {view === "calendar" && weekStart && weekHrefBase && (
                <DateNav
                  mode="single"
                  weekStartIso={isoDate(weekStart)}
                  basePath={weekHrefBase}
                  extraQuery="view=calendar"
                  todayLabel={todayLabel ?? "Today"}
                />
              )}
            </div>
          )}
        </div>
      </PageHeader>

      <div className={`${COL} flex flex-col gap-11 mt-7`}>{children}</div>
    </>
  );
}

/** The header "New event" button, shown only to roles that can create events. */
export function NewEventAction({ label }: { label: string }) {
  return (
    <Link href="/events/new" className="btn font-semibold whitespace-nowrap">
      {label}
    </Link>
  );
}

export function LinkAction({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="btno font-semibold whitespace-nowrap">
      {label}
    </Link>
  );
}
