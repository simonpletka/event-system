import { redirect } from "next/navigation";

// Per-event expenses folded into the Finance tab.
export default async function ExpensesRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/events/${id}/finance`);
}
