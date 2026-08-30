import { requireUser, dashboardVariant } from "@/lib/authz";
import { getLocale } from "@/lib/i18n";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { AccountantDashboard } from "@/components/dashboard/AccountantDashboard";
import { ProducerDashboard } from "@/components/dashboard/ProducerDashboard";
import { MemberDashboard } from "@/components/dashboard/MemberDashboard";

/**
 * Thin dispatcher: one of four role-scoped dashboards, chosen from the user's
 * resolved permissions (see dashboardVariant). Each variant owns its own
 * queries, layout and section set — there is no shared "one dashboard for
 * everyone" render path any more.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [user, locale, params] = await Promise.all([requireUser(), getLocale(), searchParams]);

  switch (dashboardVariant(user)) {
    case "admin":
      return <AdminDashboard user={user} locale={locale} params={params} />;
    case "accountant":
      return <AccountantDashboard user={user} locale={locale} />;
    case "producer":
      return <ProducerDashboard user={user} locale={locale} params={params} />;
    case "member":
      return <MemberDashboard user={user} locale={locale} />;
  }
}
