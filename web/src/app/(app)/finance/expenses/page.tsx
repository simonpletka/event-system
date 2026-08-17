import Link from "next/link";
import { requireUser, isAdmin, canEditExpense } from "@/lib/authz";
import { getExpenseList, type ExpenseListFilters } from "@/lib/queries/finance";
import { formatCurrency, formatDate } from "@/lib/format";
import { EXPENSE_CATEGORY_LABEL, EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import { deleteExpenseAction } from "@/lib/actions/finance";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import type { ExpenseCategory } from "@/generated/prisma/enums";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const filters: ExpenseListFilters = {
    eventId: params.eventId || undefined,
    category: (params.category as ExpenseCategory) || undefined,
  };
  const { expenses, total, events } = await getExpenseList(user, filters);
  const admin = isAdmin(user);

  return (
    <div>
      <div className="flex justify-between items-center gap-2 flex-wrap mt-1">
        <form method="get" className="flex gap-1.5 flex-wrap items-center">
          <select name="eventId" defaultValue={filters.eventId ?? ""} className="btno bg-transparent text-[9px]">
            <option value="">Event ▾</option>
            <option value="overhead">Company overhead</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
          <select name="category" defaultValue={filters.category ?? ""} className="btno bg-transparent text-[9px]">
            <option value="">Category ▾</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EXPENSE_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <button type="submit" className="btno text-[9px]">
            Apply
          </button>
        </form>
        <Link href="/finance/expenses/new" className="btn">
          New expense
        </Link>
      </div>

      <div className={`grid ${admin ? "grid-cols-[80px_1fr_1fr_1fr_auto_auto_auto_auto]" : "grid-cols-[80px_1fr_1fr_1fr_auto_auto_auto]"} gap-2.5 border-b-2 border-ink pb-1.5 mt-3`}>
        <span className="heading-label">Date</span>
        <span className="heading-label">Category</span>
        <span className="heading-label">Event</span>
        <span className="heading-label">Paid by</span>
        <span className="heading-label">Amount</span>
        <span className="heading-label">Receipt</span>
        <span className="heading-label"></span>
        {admin && <span className="heading-label"></span>}
      </div>

      {expenses.length === 0 && <p className="text-sm placeholder-text mt-4">No expenses match this filter.</p>}

      {expenses.map((exp) => (
        <div
          key={exp.id}
          className={`grid ${admin ? "grid-cols-[80px_1fr_1fr_1fr_auto_auto_auto_auto]" : "grid-cols-[80px_1fr_1fr_1fr_auto_auto_auto]"} gap-2.5 items-center py-2.5 border-b border-ink/13 text-[13px]`}
        >
          <div className="placeholder-text">{formatDate(exp.date)}</div>
          <div>{EXPENSE_CATEGORY_LABEL[exp.category]}</div>
          <div className="placeholder-text">
            {exp.event ? (
              <Link href={`/events/${exp.event.id}`} className="hover:text-accent">
                {exp.event.title}
              </Link>
            ) : (
              "Company overhead"
            )}
          </div>
          <div className="placeholder-text">{exp.paidBy.name}</div>
          <div>{formatCurrency(exp.amount)}</div>
          <div>
            {exp.receiptPath ? (
              <a
                href={`/api/uploads/receipts/${exp.receiptPath}`}
                target="_blank"
                rel="noreferrer"
                className="text-[9px] tracking-[0.1em] uppercase hover:text-accent"
              >
                View
              </a>
            ) : (
              <span className="placeholder-text text-[9px]">—</span>
            )}
          </div>
          <div>
            {canEditExpense(user, exp.paidById) ? (
              <Link
                href={`/finance/expenses/${exp.id}/edit`}
                className="text-[9px] tracking-[0.1em] uppercase placeholder-text hover:text-ink"
              >
                Edit
              </Link>
            ) : null}
          </div>
          {admin && (
            <ConfirmDeleteButton
              action={deleteExpenseAction}
              fields={{ id: exp.id }}
              confirmMessage={`Delete this ${formatCurrency(exp.amount)} expense? This can't be undone.`}
              className="text-[9px] tracking-[0.1em] uppercase placeholder-text hover:text-accent"
            />
          )}
        </div>
      ))}

      <div className="flex justify-end mt-3">
        <div className="label">
          Total {formatCurrency(total)} · {expenses.length} expenses
        </div>
      </div>
    </div>
  );
}
