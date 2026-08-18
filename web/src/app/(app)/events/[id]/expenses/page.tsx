import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { getEventDetail } from "@/lib/queries/events";
import { formatCurrency, formatDate } from "@/lib/format";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function ExpensesTab({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const event = await getEventDetail(user, id);
  if (!event) notFound();
  const t = getDictionary(await getLocale());
  const te = t.events.expensesTab;

  const total = event.expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="max-w-2xl">
      <p className="text-[10px] placeholder-text mb-3">{te.readOnlyHelper}</p>
      <div className="flex justify-between text-sm mb-2">
        <span className="heading-label">{te.total}</span>
        <span className="font-semibold">{formatCurrency(total)}</span>
      </div>
      {event.expenses.length === 0 && <p className="text-sm placeholder-text">{te.noExpensesRecorded}</p>}
      {event.expenses.map((exp) => (
        <div key={exp.id} className="grid grid-cols-[80px_1fr_1fr_auto] gap-2.5 items-center py-2 border-b border-ink/10 text-[13px]">
          <div className="placeholder-text">{formatDate(exp.date)}</div>
          <div>{t.expenseCategories[exp.category]}</div>
          <div className="placeholder-text">{exp.paidBy.name}{exp.note ? ` · ${exp.note}` : ""}</div>
          <div>{formatCurrency(exp.amount)}</div>
        </div>
      ))}
    </div>
  );
}
