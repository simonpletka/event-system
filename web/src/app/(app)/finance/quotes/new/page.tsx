import { requireUser, canManageFinance, eventWhereForUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { QuoteForm } from "@/components/finance/QuoteForm";

export default async function NewQuotePage() {
  const user = await requireUser();

  if (!canManageFinance(user)) {
    return (
      <div>
        <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">New quote</h1>
        <p className="text-sm placeholder-text">You don&apos;t have permission to create quotes.</p>
      </div>
    );
  }

  const events = await prisma.event.findMany({
    where: eventWhereForUser(user),
    select: { id: true, title: true, companyName: true, startDate: true },
    orderBy: { title: "asc" },
  });

  return (
    <div>
      <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">New quote</h1>
      <QuoteForm events={events} />
    </div>
  );
}
