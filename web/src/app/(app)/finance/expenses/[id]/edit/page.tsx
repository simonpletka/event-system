import { notFound } from "next/navigation";
import { requireUser, eventWhereForUser, canPickOtherPayer, canEditExpense } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { ExpenseForm } from "@/components/finance/ExpenseForm";
import { BackLink } from "@/components/BackLink";

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const expense = await prisma.expense.findUnique({ where: { id }, include: { paidBy: true } });
  if (!expense) notFound();

  if (!canEditExpense(user, expense.paidById)) {
    return (
      <div>
        <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">Edit expense</h1>
        <p className="text-sm placeholder-text">You don&apos;t have permission to edit this expense.</p>
      </div>
    );
  }

  const [events, cardHolders] = await Promise.all([
    prisma.event.findMany({
      where: eventWhereForUser(user),
      select: { id: true, title: true, companyName: true },
      orderBy: { title: "asc" },
    }),
    prisma.user.findMany({
      where: { isCardHolder: true, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const payers = canPickOtherPayer(user)
    ? [{ id: expense.paidById, name: expense.paidBy.name }, ...cardHolders.filter((c) => c.id !== expense.paidById)]
    : [{ id: user.id, name: user.name ?? "Me" }];

  return (
    <div>
      <BackLink href="/finance/expenses">Expenses</BackLink>
      <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">Edit expense</h1>
      <ExpenseForm
        events={events}
        payers={payers}
        currentUserId={user.id}
        defaults={{
          id: expense.id,
          eventId: expense.eventId,
          amount: expense.amount,
          date: expense.date.toISOString().slice(0, 10),
          paidById: expense.paidById,
          category: expense.category,
          note: expense.note,
          receiptPath: expense.receiptPath,
        }}
      />
    </div>
  );
}
