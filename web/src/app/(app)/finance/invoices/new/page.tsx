import { requireUser, canManageFinance, eventWhereForUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { InvoiceForm } from "@/components/finance/InvoiceForm";

export default async function NewInvoicePage() {
  const user = await requireUser();

  if (!canManageFinance(user)) {
    return (
      <div>
        <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">New invoice</h1>
        <p className="text-sm placeholder-text">You don&apos;t have permission to create invoices.</p>
      </div>
    );
  }

  const [events, company] = await Promise.all([
    prisma.event.findMany({
      where: eventWhereForUser(user),
      select: { id: true, title: true, companyName: true },
      orderBy: { title: "asc" },
    }),
    prisma.companySettings.findUnique({ where: { id: "singleton" } }),
  ]);

  const dueDays = company?.defaultDueDays ?? 14;
  const defaultDueDate = new Date(new Date().getTime() + dueDays * 86400000).toISOString().slice(0, 10);

  return (
    <div>
      <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">New invoice</h1>
      <InvoiceForm events={events} defaultDueDate={defaultDueDate} />
    </div>
  );
}
