import { redirect } from "next/navigation";

// Per-event quotes & invoices folded into the Finance tab.
export default async function QuotesRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/events/${id}/finance`);
}
