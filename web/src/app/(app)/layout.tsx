import { requireUser } from "@/lib/authz";
import { getRunningTimer } from "@/lib/queries/timetracker";
import { Sidebar } from "@/components/Sidebar";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialogProvider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const running = await getRunningTimer(user.id);

  return (
    <ConfirmDialogProvider>
      <div className="min-h-screen flex">
        <Sidebar
          userName={user.name ?? user.email ?? "Signed in"}
          running={running ? { eventTitle: running.event.title, startedAt: running.startedAt!.toISOString() } : null}
        />
        <main className="flex-1 min-w-0 px-6 py-5">{children}</main>
      </div>
    </ConfirmDialogProvider>
  );
}
