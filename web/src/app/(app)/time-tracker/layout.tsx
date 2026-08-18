import { requireUser } from "@/lib/authz";
import { TimeTrackerTabs } from "@/components/TimeTrackerTabs";

export default async function TimeTrackerLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-6 -mt-5 px-6 pt-5 pb-2 backdrop-blur-2xl bg-gradient-to-b from-bg/80 to-bg/50 border-b border-ink/10">
        <h1 className="text-[28px] font-bold tracking-tight">Time tracker</h1>
        <div className="mt-3">
          <TimeTrackerTabs />
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
