import Link from "next/link";
import { getMemberDashboard } from "@/lib/queries/dashboard";
import { getOverviewData } from "@/lib/queries/timetracker";
import { getDictionary, type Locale } from "@/lib/i18n";
import type { SessionUser } from "@/lib/authz";
import { DashboardShell, LinkAction } from "./DashboardShell";
import {
  SectionHeading,
  EventCard,
  EventCardGrid,
  ExpenseList,
  TrackedTimeChart,
  EmptyState,
  type DashEventCard,
} from "./widgets";

export async function MemberDashboard({ user, locale }: { user: SessionUser; locale: Locale }) {
  const t = getDictionary(locale);
  const td = t.dashboard;

  const [d, timeData] = await Promise.all([
    getMemberDashboard(user),
    getOverviewData([{ id: user.id, name: user.name ?? "" }], "week", new Date()),
  ]);
  const myTime = timeData.rows[0];

  const cards: DashEventCard[] = d.events.map((e) => ({
    id: e.id,
    title: e.title,
    company: e.companyName,
    status: e.status,
    start: e.startDate,
    end: e.endDate,
    venue: e.venues[0]?.name ?? null,
    nextTitle: e.roadmapItems[0]?.title ?? null,
  }));

  return (
    <DashboardShell title={td.title} action={<LinkAction href="/events" label={td.browseAllEvents} />}>
      <div>
        <SectionHeading label={td.myEvents} sub={td.myEventsReadOnly} />
        {cards.length === 0 ? (
          <EmptyState>{td.noAssignedEvents}</EmptyState>
        ) : (
          <EventCardGrid>
            {cards.map((ev) => (
              <EventCard key={ev.id} ev={ev} t={t} />
            ))}
          </EventCardGrid>
        )}
      </div>

      <div>
        <SectionHeading label={td.myExpenses} sub={td.myExpensesSubtitle} />
        <ExpenseList expenses={d.expenses} t={t} />
        <Link href="/finance/expenses/new" className="btn font-semibold inline-block mt-4">
          {td.addExpense}
        </Link>
      </div>

      <TrackedTimeChart
        buckets={timeData.buckets}
        byBucket={myTime?.byBucket ?? []}
        total={myTime?.total ?? 0}
        t={t}
      />
    </DashboardShell>
  );
}
