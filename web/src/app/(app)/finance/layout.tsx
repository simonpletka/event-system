import { requireUser, canViewFinance, quoteWhereForUser, invoiceWhereForUser, expenseWhereForUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { FinanceTabs } from "@/components/finance/FinanceTabs";

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  if (!canViewFinance(user)) {
    return (
      <div>
        <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">Finance</h1>
        <p className="text-sm placeholder-text">You don&apos;t have access to Finance.</p>
      </div>
    );
  }

  const [quoteCount, invoiceCount, expenseCount] = await Promise.all([
    prisma.quote.count({ where: quoteWhereForUser(user) }),
    prisma.invoice.count({ where: invoiceWhereForUser(user) }),
    prisma.expense.count({ where: expenseWhereForUser(user) }),
  ]);

  return (
    <div>
      <div className="flex items-end justify-between border-b-2 border-ink pb-2">
        <div>
          <div className="heading-label">{quoteCount + invoiceCount + expenseCount} open documents</div>
          <h1 className="text-xl font-semibold">Finance</h1>
        </div>
      </div>
      <div className="mt-2.5">
        <FinanceTabs counts={{ quotes: quoteCount, invoices: invoiceCount, expenses: expenseCount }} />
      </div>
      <div className="mt-3.5">{children}</div>
    </div>
  );
}
