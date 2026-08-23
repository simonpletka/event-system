import { requireUser, getFreshUserFields } from "@/lib/authz";
import { getRunningTimer } from "@/lib/queries/timetracker";
import { getLocale, getDictionary } from "@/lib/i18n";
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
  const runningProp = running ? { eventTitle: running.event.title, startedAt: running.startedAt!.toISOString() } : null;
  const displayName = freshUser?.name ?? user.name ?? user.email ?? "Signed in";
  const avatarUrl = freshUser?.avatarPath ? `/api/uploads/avatar/${freshUser.avatarPath}` : null;

  return (
    <ConfirmDialogProvider defaultLabels={t.confirmDialog}>
      <div className="min-h-screen flex">
        <Sidebar userName={displayName} avatarUrl={avatarUrl} running={runningProp} tNav={t.nav} tSidebar={t.sidebar} />
        <main className="flex-1 min-w-0 px-6 py-5 pb-24 md:pb-5">
          <MobileTopBar userName={displayName} avatarUrl={avatarUrl} running={runningProp} tNav={t.nav} tSidebar={t.sidebar} />
          {children}
        </main>
        <MobileNav tNav={t.nav} />
      </div>
    </ConfirmDialogProvider>
  );
}
