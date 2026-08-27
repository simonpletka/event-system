import Link from "next/link";
import { requireUser, isAdmin, canEditExpense } from "@/lib/authz";
import { getExpenseList, type ExpenseListFilters } from "@/lib/queries/finance";
import { formatCurrency, formatDate } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import { deleteExpenseAction } from "@/lib/actions/finance";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { TrashIcon } from "@/components/ui/icons";
import { Menu, MenuLink } from "@/components/ui/Menu";
import { GroupIcon } from "@/components/ui/icons";
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
  const grouped = params.group === "event";

  // One group per event (plus a company-overhead bucket), each with a subtotal.
  // Not grouped → a single passthrough group so the render path is the same.
  type Group = { key: string; label: string; rows: typeof expenses; subtotal: number };
  let groups: Group[];
  if (grouped) {
    const byKey = new Map<string, Group>();
    for (const exp of expenses) {
      const key = exp.event?.id ?? "overhead";
      const label = exp.event?.title ?? te.companyOverheadFallback;
      const g = byKey.get(key) ?? { key, label, rows: [], subtotal: 0 };
      g.rows.push(exp);
      g.subtotal += exp.amount;
      byKey.set(key, g);
    }
    groups = [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label));
  } else {
    groups = [{ key: "all", label: "", rows: expenses, subtotal: total }];
  }

  const groupHref = (g: string) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ eventId: filters.eventId, category: filters.category, group: g || undefined })) {
      if (v) p.set(k, v);
    }
    const qs = p.toString();
    return qs ? `/finance/expenses?${qs}` : "/finance/expenses";
  };

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
        <div className="flex items-center gap-2 shrink-0">
          <Menu icon={<GroupIcon size={13} />} value={grouped ? t.finance.groupBy.event : t.finance.groupBy.none} width={150}>
            <MenuLink href={groupHref("")} active={!grouped}>
              {t.finance.groupBy.none}
            </MenuLink>
            <MenuLink href={groupHref("event")} active={grouped}>
              {t.finance.groupBy.event}
            </MenuLink>
          </Menu>
          <Link href="/finance/expenses/new" className="btn font-semibold shrink-0">
            {te.newExpense}
          </Link>
        </div>
      </div>

      <div className="hidden md:block">
        <div className="grid grid-cols-[80px_1fr_1fr_1fr_auto_auto_auto] gap-2.5 border-b border-ink/14 pb-1.5 mt-5 px-3.5 [&_.heading-label]:font-bold [&_.heading-label]:!text-[9px]">
          <span className="heading-label">{te.colDate}</span>
          <span className="heading-label">{te.colCategory}</span>
          <span className="heading-label">{te.colEvent}</span>
          <span className="heading-label">{te.colPaidBy}</span>
          <span className="heading-label">{te.colAmount}</span>
          <span className="heading-label">{te.colReceipt}</span>
          <span className="heading-label"></span>
        </div>

        {groups.map((g) => (
          <div key={g.key}>
          {grouped && (
            <div className="flex items-baseline justify-between px-3.5 pt-5 pb-1.5 border-b border-ink/14">
              <span className="heading-label !text-[11px] !text-ink">{g.label}</span>
              <span className="text-[13px] font-semibold tabular-nums">{formatCurrency(g.subtotal)}</span>
            </div>
          )}
          {g.rows.map((exp) => (
          <div
            key={exp.id}
            className="group grid grid-cols-[80px_1fr_1fr_1fr_auto_auto_auto] gap-2.5 items-center py-3.5 px-3.5 rounded-xl border-b border-ink/8 last:border-b-0 text-[15px] hover:bg-ink/5"
          >
            <div className="placeholder-text group-hover:!text-accent">{formatDate(exp.date)}</div>
            <div className="group-hover:text-accent">{t.expenseCategories[exp.category]}</div>
            <div className="placeholder-text group-hover:!text-accent">
              {exp.event ? (
                <Link href={`/events/${exp.event.id}`}>{exp.event.title}</Link>
              ) : (
                te.companyOverheadFallback
              )}
            </div>
            <div className="placeholder-text group-hover:!text-accent">{exp.paidBy.name}</div>
            <div className="font-semibold tabular-nums group-hover:text-accent">{formatCurrency(exp.amount)}</div>
            <div>
              {exp.receiptPath ? (
                <a
                  href={`/api/uploads/receipts/${exp.receiptPath}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[9px] tracking-[0.1em] uppercase placeholder-text hover:text-accent"
                >
                  {te.viewReceipt}
                </a>
              ) : (
                <span className="placeholder-text text-[9px]">—</span>
              )}
            </div>
            <div className="flex items-center justify-end gap-1.5 text-[9px] tracking-[0.1em] uppercase">
              {canEditExpense(user, exp.paidById) && (
                <Link href={`/finance/expenses/${exp.id}/edit`} className="placeholder-text hover:text-accent">
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
                  title={t.common.delete}
                  className="shrink-0 grid place-items-center w-7 h-7 rounded-md text-ink/35 hover:text-warning hover:bg-warning/10 transition-colors disabled:opacity-40"
                >
                  <TrashIcon />
                </ConfirmDeleteButton>
              )}
            </div>
          </div>
          ))}
          </div>
        ))}
      </div>

      {/* Mobile: not MobileListRow -- desktop rows are plain <div>s (no whole-row
          link) with a separate per-row Edit link + receipt link + Delete button,
          so a card with its own inline actions matches the source shape better
          than forcing a single navigable Link. */}
      <div className="md:hidden flex flex-col gap-2 mt-4">
        {groups.map((g) => (
          <div key={g.key} className="flex flex-col gap-2">
          {grouped && (
            <div className="flex items-baseline justify-between px-1 pt-2">
              <span className="heading-label !text-[11px] !text-ink">{g.label}</span>
              <span className="text-[12px] font-semibold tabular-nums">{formatCurrency(g.subtotal)}</span>
            </div>
          )}
          {g.rows.map((exp) => (
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
                  title={t.common.delete}
                  className="shrink-0 grid place-items-center w-8 h-8 rounded-md text-ink/40 hover:text-warning transition-colors ml-auto"
                >
                  <TrashIcon size={16} />
                </ConfirmDeleteButton>
              )}
            </div>
          </div>
          ))}
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
