import { requireUser, getFreshUserFields, projectWhereForUser, canManageGear } from "@/lib/authz";
import { getOpenGearIssueCount } from "@/lib/queries/gear-ops";
import { getRunningTimer } from "@/lib/queries/timetracker";
import { getLocale, getDictionary } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { isTestMode } from "@/lib/data-mode";
import { Sidebar } from "@/components/Sidebar";
import { STUDIO_APPS } from "@/lib/studio";
import { MobileTopBar } from "@/components/mobile/MobileTopBar";
import { MobileNav } from "@/components/mobile/MobileNav";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialogProvider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Fresh (not JWT-cached) name/avatar so a Settings → General edit shows up
  // immediately here instead of waiting for the session token to refresh at
  // next login — cache()-deduped with requireUser()'s own lookup, so this is
  // free within the same request, not a second query.
  const [running, freshUser, locale, testMode, openGearIssues] = await Promise.all([
    getRunningTimer(user.id),
    getFreshUserFields(user.id),
    getLocale(),
    isTestMode(),
    // Gear managers see the open-issue count on the sidebar's Gear item.
    canManageGear(user) ? getOpenGearIssueCount() : Promise.resolve(0),
  ]);
  const t = getDictionary(locale);
  // Only fetched when actually needed (a running-but-unassigned timer, for the
  // sidebar's inline assign-event select) — avoids the extra query on every
  // page load otherwise, since this layout runs on every navigation.
  const assignableProjects =
    running && !running.projectId
      ? await prisma.project.findMany({ where: projectWhereForUser(user), select: { id: true, title: true }, orderBy: { title: "asc" } })
      : [];
  const runningProp = running
    ? { projectId: running.projectId, projectTitle: running.project?.title ?? null, startedAt: running.startedAt!.toISOString() }
    : null;
  const displayName = freshUser?.name ?? user.name ?? user.email ?? "Signed in";
  const avatarUrl = freshUser?.avatarPath ? `/api/uploads/avatar/${freshUser.avatarPath}` : null;

  return (
    <ConfirmDialogProvider defaultLabels={t.confirmDialog}>
      <div className="min-h-dvh flex">
        <Sidebar
          userName={displayName}
          avatarUrl={avatarUrl}
          running={runningProp}
          projects={assignableProjects}
          tNav={t.nav}
          tSidebar={t.sidebar}
          tTimeTracker={{ tabTracking: t.timeTracker.tabTracking, tabReport: t.timeTracker.tabReport }}
          tElapsed={t.timeTracker.editableElapsed}
          discardedMessage={t.timeTracker.runningTimer.discardedTooShort}
          studioNav={STUDIO_APPS.map((app) => ({ href: `/studio/${app.slug}`, label: t.studio.apps[app.slug].name }))}
          badges={{ "/gear": openGearIssues }}
        />
        <main className="flex-1 min-w-0 px-6 py-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-5">
          <MobileTopBar
            userName={displayName}
            avatarUrl={avatarUrl}
            running={runningProp}
            projects={assignableProjects}
            tNav={t.nav}
            tSidebar={t.sidebar}
            tElapsed={t.timeTracker.editableElapsed}
            discardedMessage={t.timeTracker.runningTimer.discardedTooShort}
          />
          {children}
        </main>
        <MobileNav tNav={t.nav} />
      </div>
      {testMode && (
        // Always visible in the testing view, so it's never mistaken for real data.
        // Sits above the mobile tab bar; pointer-events-none so it never blocks a click.
        <div
          title={t.auth.testingBadgeHint}
          className="fixed z-50 right-3 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] md:bottom-4 md:right-4 pointer-events-none rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
        >
          {t.auth.testingBadge}
        </div>
      )}
    </ConfirmDialogProvider>
  );
}
