import { redirect } from "next/navigation";

// Per-event quotes & invoices folded into the Finance tab.
export default async function QuotesRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/projects/${slug}/finance`);
}
