import Link from "next/link";
import { requireUser, isAdmin, canEditExpense } from "@/lib/authz";
import { getExpenseList, type ExpenseListFilters } from "@/lib/queries/finance";
import { formatCurrency, formatDate } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import { deleteExpenseAction } from "@/lib/actions/finance";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { getLocale, getDictionary } from "@/lib/i18n";
import type { ExpenseCategory } from "@/generated/prisma/enums";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const t = getDictionary(await getLocale());
  const te = t.finance.expenses;
  const filters: ExpenseListFilters = {
    eventId: params.eventId || undefined,
    category: (params.category as ExpenseCategory) || undefined,
  };
  const { expenses, total, events } = await getExpenseList(user, filters);
  const admin = isAdmin(user);

  return (
    <div>
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <form method="get" className="flex gap-1.5 flex-wrap items-center">
          <select name="eventId" defaultValue={filters.eventId ?? ""} className="btno bg-transparent text-[9px]">
            <option value="">{te.eventFilter}</option>
            <option value="overhead">{te.companyOverheadOption}</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
          <select name="category" defaultValue={filters.category ?? ""} className="btno bg-transparent text-[9px]">
            <option value="">{te.categoryFilter}</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t.expenseCategories[c]}
              </option>
            ))}
          </select>
          <button type="submit" className="btno text-[9px]">
            {te.apply}
          </button>
        </form>
        <Link href="/finance/expenses/new" className="btn font-semibold">
          {te.newExpense}
        </Link>
      </div>

      <div className={`grid ${admin ? "grid-cols-[80px_1fr_1fr_1fr_auto_auto_auto_auto]" : "grid-cols-[80px_1fr_1fr_1fr_auto_auto_auto]"} gap-2.5 border-b border-ink/14 pb-1.5 mt-5 px-3.5`}>
        <span className="heading-label">{te.colDate}</span>
        <span className="heading-label">{te.colCategory}</span>
        <span className="heading-label">{te.colEvent}</span>
        <span className="heading-label">{te.colPaidBy}</span>
        <span className="heading-label">{te.colAmount}</span>
        <span className="heading-label">{te.colReceipt}</span>
        <span className="heading-label"></span>
        {admin && <span className="heading-label"></span>}
      </div>

      {expenses.length === 0 && <p className="text-sm placeholder-text mt-4">{te.noExpensesMatch}</p>}

      {expenses.map((exp) => (
        <div
          key={exp.id}
          className={`grid ${admin ? "grid-cols-[80px_1fr_1fr_1fr_auto_auto_auto_auto]" : "grid-cols-[80px_1fr_1fr_1fr_auto_auto_auto]"} gap-2.5 items-center py-3 px-3.5 rounded-xl border-b border-ink/8 last:border-b-0 text-[13px] hover:bg-ink/5`}
        >
          <div className="placeholder-text">{formatDate(exp.date)}</div>
          <div>{t.expenseCategories[exp.category]}</div>
          <div className="placeholder-text">
            {exp.event ? (
              <Link href={`/events/${exp.event.id}`} className="hover:text-accent">
                {exp.event.title}
              </Link>
            ) : (
              te.companyOverheadFallback
            )}
          </div>
          <div className="placeholder-text">{exp.paidBy.name}</div>
          <div className="font-semibold tabular-nums">{formatCurrency(exp.amount)}</div>
          <div>
            {exp.receiptPath ? (
              <a
                href={`/api/uploads/receipts/${exp.receiptPath}`}
                target="_blank"
                rel="noreferrer"
                className="text-[9px] tracking-[0.1em] uppercase hover:text-accent"
              >
                {te.viewReceipt}
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
                {te.edit}
              </Link>
            ) : null}
          </div>
          {admin && (
            <ConfirmDeleteButton
              action={deleteExpenseAction}
              fields={{ id: exp.id }}
              label={t.common.delete}
              pendingLabel={t.common.deleting}
              confirmMessage={te.confirmDelete(formatCurrency(exp.amount))}
              className="text-[9px] tracking-[0.1em] uppercase placeholder-text hover:text-warning"
            />
          )}
        </div>
      ))}

      <div className="flex justify-end mt-4 px-3.5">
        <div className="label">{te.totalCountNote(formatCurrency(total), expenses.length)}</div>
      </div>
    </div>
  );
}
