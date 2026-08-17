import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { getEventDetail } from "@/lib/queries/events";
import { formatCurrency, formatDate } from "@/lib/format";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/expense-categories";

export default async function ExpensesTab({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const event = await getEventDetail(user, id);
  if (!event) notFound();

  const total = event.expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="max-w-2xl">
      <p className="text-[10px] placeholder-text mb-3">
        Full expense management (adding, receipt uploads, approval) lands in the Finance phase — this is a read-only view.
      </p>
      <div className="flex justify-between text-sm mb-2">
        <span className="heading-label">Total</span>
        <span className="font-semibold">{formatCurrency(total)}</span>
      </div>
      {event.expenses.length === 0 && <p className="text-sm placeholder-text">No expenses recorded.</p>}
      {event.expenses.map((exp) => (
        <div key={exp.id} className="grid grid-cols-[80px_1fr_1fr_auto] gap-2.5 items-center py-2 border-b border-ink/10 text-[13px]">
          <div className="placeholder-text">{formatDate(exp.date)}</div>
          <div>{EXPENSE_CATEGORY_LABEL[exp.category]}</div>
          <div className="placeholder-text">{exp.paidBy.name}{exp.note ? ` · ${exp.note}` : ""}</div>
          <div>{formatCurrency(exp.amount)}</div>
        </div>
      ))}
    </div>
  );
}
