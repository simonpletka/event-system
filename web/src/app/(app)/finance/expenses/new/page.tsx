import { requireUser, eventWhereForUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { ExpenseForm } from "@/components/finance/ExpenseForm";

export default async function NewExpensePage() {
  const user = await requireUser();

  const [events, cardHolders] = await Promise.all([
    prisma.event.findMany({
      where: eventWhereForUser(user),
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.user.findMany({ where: { isCardHolder: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const payers =
    user.role === "MEMBER" && !user.isCardHolder
      ? [{ id: user.id, name: user.name ?? "Me" }]
      : [
          { id: user.id, name: user.name ?? "Me" },
          ...cardHolders.filter((c) => c.id !== user.id),
        ];

  return (
    <div>
      <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">New expense</h1>
      <ExpenseForm events={events} payers={payers} currentUserId={user.id} />
    </div>
  );
}
