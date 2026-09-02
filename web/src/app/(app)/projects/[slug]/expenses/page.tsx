import { redirect } from "next/navigation";

// Per-event expenses folded into the Finance tab.
export default async function ExpensesRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/projects/${slug}/finance`);
}
