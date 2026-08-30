import { redirect } from "next/navigation";

// No per-event Time tab any more — the Overview shows the total + "Show all
// logs" (which opens the full report filtered to this event).
export default async function TimeRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/events/${id}`);
}
