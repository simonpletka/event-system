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
        <form
          method="get"
          className="flex gap-1.5 items-center flex-nowrap overflow-x-auto pb-1 md:pb-0 md:flex-wrap md:overflow-visible"
        >
          <select name="eventId" defaultValue={filters.eventId ?? ""} className="btno bg-transparent text-[9px] shrink-0">
            <option value="">{te.eventFilter}</option>
            <option value="overhead">{te.companyOverheadOption}</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
          <select name="category" defaultValue={filters.category ?? ""} className="btno bg-transparent text-[9px] shrink-0">
            <option value="">{te.categoryFilter}</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t.expenseCategories[c]}
              </option>
            ))}
          </select>
          <button type="submit" className="btno text-[9px] shrink-0">
            {te.apply}
          </button>
        </form>
        <Link href="/finance/expenses/new" className="btn font-semibold shrink-0">
          {te.newExpense}
        </Link>
      </div>

      <div className="hidden md:block">
        <div
          className={`grid ${admin ? "grid-cols-[80px_1fr_1fr_1fr_auto_auto_auto_auto]" : "grid-cols-[80px_1fr_1fr_1fr_auto_auto_auto]"} gap-2.5 border-b border-ink/14 pb-1.5 mt-5 px-3.5`}
        >
          <span className="heading-label">{te.colDate}</span>
          <span className="heading-label">{te.colCategory}</span>
          <span className="heading-label">{te.colEvent}</span>
          <span className="heading-label">{te.colPaidBy}</span>
          <span className="heading-label">{te.colAmount}</span>
          <span className="heading-label">{te.colReceipt}</span>
          <span className="heading-label"></span>
          {admin && <span className="heading-label"></span>}
        </div>

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
      </div>

      {/* Mobile: not MobileListRow -- desktop rows are plain <div>s (no whole-row
          link) with a separate per-row Edit link + receipt link + Delete button,
          so a card with its own inline actions matches the source shape better
          than forcing a single navigable Link. */}
      <div className="md:hidden flex flex-col gap-2 mt-4">
        {expenses.map((exp) => (
          <div key={exp.id} className="card px-3.5 py-3.5">
            <div className="flex items-start justify-between gap-2.5">
              <div className="min-w-0">
                <div className="placeholder-text text-[10.5px] mb-0.5">{formatDate(exp.date)}</div>
                <div className="text-[14px] font-semibold">{t.expenseCategories[exp.category]}</div>
                <div className="placeholder-text text-[11.5px] mt-0.5">
                  {exp.event ? (
                    <Link href={`/events/${exp.event.id}`} className="hover:text-accent">
                      {exp.event.title}
                    </Link>
                  ) : (
                    te.companyOverheadFallback
                  )}
                  {" · "}
                  {exp.paidBy.name}
                </div>
              </div>
              <div className="text-right shrink-0 text-[13px] font-semibold">{formatCurrency(exp.amount)}</div>
            </div>
            <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-ink/8 text-[9px] tracking-[0.1em] uppercase">
              {exp.receiptPath ? (
                <a href={`/api/uploads/receipts/${exp.receiptPath}`} target="_blank" rel="noreferrer" className="hover:text-accent">
                  {te.viewReceipt}
                </a>
              ) : (
                <span className="placeholder-text">—</span>
              )}
              {canEditExpense(user, exp.paidById) && (
                <Link href={`/finance/expenses/${exp.id}/edit`} className="placeholder-text hover:text-ink">
                  {te.edit}
                </Link>
              )}
              {admin && (
                <ConfirmDeleteButton
                  action={deleteExpenseAction}
                  fields={{ id: exp.id }}
                  label={t.common.delete}
                  pendingLabel={t.common.deleting}
                  confirmMessage={te.confirmDelete(formatCurrency(exp.amount))}
                  className="placeholder-text hover:text-warning ml-auto"
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {expenses.length === 0 && <p className="text-sm placeholder-text mt-4">{te.noExpensesMatch}</p>}

      <div className="flex justify-end mt-4 px-3.5">
        <div className="label">{te.totalCountNote(formatCurrency(total), expenses.length)}</div>
      </div>
    </div>
  );
}
