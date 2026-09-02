import Link from "next/link";
import { getMemberDashboard } from "@/lib/queries/dashboard";
import { getOverviewData } from "@/lib/queries/timetracker";
import { getDictionary, type Locale } from "@/lib/i18n";
import type { SessionUser } from "@/lib/authz";
import { DashboardShell, LinkAction } from "./DashboardShell";
import {
  SectionHeading,
  ProjectCard,
  ProjectCardGrid,
  ExpenseList,
  TrackedTimeChart,
  EmptyState,
  type DashProjectCard,
} from "./widgets";

export async function MemberDashboard({ user, locale }: { user: SessionUser; locale: Locale }) {
  const t = getDictionary(locale);
  const td = t.dashboard;

  const [d, timeData] = await Promise.all([
    getMemberDashboard(user),
    getOverviewData([{ id: user.id, name: user.name ?? "" }], "week", new Date()),
  ]);
  const myTime = timeData.rows[0];

  const cards: DashProjectCard[] = d.projects.map((e) => ({
    id: e.id,
    number: e.number,
    title: e.title,
    company: e.companyName,
    status: e.status,
    start: e.startDate,
    end: e.endDate,
    venue: e.venues[0]?.name ?? null,
    nextTitle: e.roadmapItems[0]?.title ?? null,
  }));

  return (
    <DashboardShell title={td.title} action={<LinkAction href="/projects" label={td.browseAllProjects} />}>
      <div>
        <SectionHeading label={td.myProjects} sub={td.myProjectsReadOnly} />
        {cards.length === 0 ? (
          <EmptyState>{td.noAssignedProjects}</EmptyState>
        ) : (
          <ProjectCardGrid>
            {cards.map((ev) => (
              <ProjectCard key={ev.id} ev={ev} t={t} />
            ))}
          </ProjectCardGrid>
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
