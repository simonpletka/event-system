import { redirect } from "next/navigation";

// Milestones folded into the Roadmap tab.
export default async function MilestonesRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/projects/${slug}/roadmap`);
}
