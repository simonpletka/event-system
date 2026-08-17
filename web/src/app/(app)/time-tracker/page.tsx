import { requireUser } from "@/lib/authz";
import { ComingSoon } from "@/components/ComingSoon";

export default async function TimeTrackerPage() {
  await requireUser();
  return (
    <ComingSoon
      title="Time tracker"
      description="Starting/stopping a timer, manual entries, and comparing events land in the next phase. Time already logged against events is visible on each event's Time tab."
    />
  );
}
