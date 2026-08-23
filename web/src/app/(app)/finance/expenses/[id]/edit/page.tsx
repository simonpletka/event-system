import { notFound } from "next/navigation";
import { requireUser, eventWhereForUser, canPickOtherPayer, canEditExpense } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { ExpenseForm } from "@/components/finance/ExpenseForm";
import { BackLink } from "@/components/BackLink";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const locale = await getLocale();
  const t = getDictionary(locale);

  const expense = await prisma.expense.findUnique({ where: { id }, include: { paidBy: true } });
  if (!expense) notFound();

  if (!canEditExpense(user, expense.paidById)) {
    return (
      <div>
        <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">{t.finance.expenses.editExpense}</h1>
        <p className="text-lg font-semibold text-ink">{t.finance.expenses.noPermEdit}</p>
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
      <BackLink href="/finance/expenses">{t.finance.expenses.backLink}</BackLink>
      <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">{t.finance.expenses.editExpense}</h1>
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
        locale={locale}
      />
    </div>
  );
}
