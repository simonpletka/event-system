import { redirect } from "next/navigation";

// Milestones folded into the Roadmap tab.
export default async function MilestonesRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/events/${id}/roadmap`);
}
