import { redirect } from "next/navigation";

// No per-event Time tab any more — the Overview shows the total + "Show all
// logs" (which opens the full report filtered to this event).
export default async function TimeRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/projects/${slug}`);
}
