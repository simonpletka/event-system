import { requireUser, getFreshUserFields, projectWhereForUser } from "@/lib/authz";
import { getRunningTimer } from "@/lib/queries/timetracker";
import { getLocale, getDictionary } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/Sidebar";
import { MobileTopBar } from "@/components/mobile/MobileTopBar";
import { MobileNav } from "@/components/mobile/MobileNav";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialogProvider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Fresh (not JWT-cached) name/avatar so a Settings → General edit shows up
  // immediately here instead of waiting for the session token to refresh at
  // next login — cache()-deduped with requireUser()'s own lookup, so this is
  // free within the same request, not a second query.
  const [running, freshUser, locale] = await Promise.all([getRunningTimer(user.id), getFreshUserFields(user.id), getLocale()]);
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
    </ConfirmDialogProvider>
  );
}
