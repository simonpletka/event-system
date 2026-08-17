import { requireUser } from "@/lib/authz";
import { TimeTrackerTabs } from "@/components/TimeTrackerTabs";

export default async function TimeTrackerLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  return (
    <div>
      <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-3">Time tracker</h1>
      <div className="pb-2.5 border-b border-ink/20 mb-3.5">
        <TimeTrackerTabs />
      </div>
      {children}
    </div>
  );
}
