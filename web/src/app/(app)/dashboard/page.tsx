import { requireUser, canCreateProject } from "@/lib/authz";
import { getLocale, getDictionary } from "@/lib/i18n";
import { getDashboardData } from "@/lib/queries/dashboard";
import { loadDashboardMonthAction } from "@/lib/actions/dashboard";
import { PageHeader } from "@/components/ui/PageHeader";
import { DashboardView } from "@/components/dashboard/DashboardView";
import Link from "next/link";

/**
 * One dashboard layout for every role. Each section only renders for roles
 * that can see its data: Finance needs full finance access, Latest expenses
 * follows expense access, and Projects/Tasks cover what the role can see
 * (company-wide for Admin and Accountant, assigned projects otherwise).
 */
export default async function DashboardPage() {
  const [user, locale] = await Promise.all([requireUser(), getLocale()]);
  const t = getDictionary(locale).dashboard;
  const d = await getDashboardData(user);

  return (
    <>
      <PageHeader>
        <div className="max-w-[1080px] flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-[46px] md:text-[60px] font-bold tracking-tight">{t.title}</h1>
          {canCreateProject(user) && (
            <Link href="/projects/new" className="btn font-semibold whitespace-nowrap">
              {t.newProject}
            </Link>
          )}
        </div>
      </PageHeader>
      <div className="max-w-[1080px] mt-7">
        <DashboardView
          locale={locale}
          today={d.today}
          upcoming={d.upcoming}
          month={d.month}
          loadMonth={loadDashboardMonthAction}
          tasks={d.tasks}
          meetings={d.meetings}
          canCreateMeeting={d.canCreateMeeting}
          finance={d.finance}
          expenses={d.expenses}
        />
      </div>
    </>
  );
}
