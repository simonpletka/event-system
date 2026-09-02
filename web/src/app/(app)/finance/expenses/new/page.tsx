import { requireUser, projectWhereForUser, canPickOtherPayer } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { ExpenseForm } from "@/components/finance/ExpenseForm";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function NewExpensePage() {
  const user = await requireUser();
  const locale = await getLocale();
  const t = getDictionary(locale);

  const [events, cardHolders] = await Promise.all([
    prisma.project.findMany({
      where: projectWhereForUser(user),
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
    ? [{ id: user.id, name: user.name ?? "Me" }, ...cardHolders.filter((c) => c.id !== user.id)]
    : [{ id: user.id, name: user.name ?? "Me" }];

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">{t.finance.expenses.newExpenseH1}</h1>
      <ExpenseForm events={events} payers={payers} currentUserId={user.id} locale={locale} />
    </div>
  );
}
