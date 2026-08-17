import Link from "next/link";
import { requireUser, canCreateEvent } from "@/lib/authz";
import { getDashboardData } from "@/lib/queries/dashboard";
import { formatCurrency, formatDateRange } from "@/lib/format";
import { EventStatusPill } from "@/components/StatusPill";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/expense-categories";

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboardData(user);
  const maxMonthly = Math.max(1, ...data.monthly.flatMap((m) => [m.income, m.expense]));

  return (
    <div>
      <div className="flex items-end justify-between border-b-2 border-ink pb-2">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        {canCreateEvent(user) && (
          <Link href="/events/new" className="btn">
            New event
          </Link>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pb-2.5 border-b border-ink/20">
        <div className="flex border border-ink">
          <span className="text-[9px] tracking-[0.14em] uppercase px-3 py-1.5 bg-ink text-bg">List</span>
          <span
            className="text-[9px] tracking-[0.14em] uppercase px-3 py-1.5 border-l border-ink placeholder-text cursor-not-allowed"
            title="Timeline view lands in a later phase"
          >
            Timeline
          </span>
          <span
            className="text-[9px] tracking-[0.14em] uppercase px-3 py-1.5 border-l border-ink placeholder-text cursor-not-allowed"
            title="Calendar view lands in a later phase"
          >
            Calendar
          </span>
        </div>
      </div>

      <div className="heading-label mt-4 mb-1.5">Needs attention</div>
      <div className="grid grid-cols-3 gap-px bg-ink/20 border border-ink/20">
        <AttentionTile
          label={`${data.needsAttention.overdueInvoices.count} invoice${data.needsAttention.overdueInvoices.count === 1 ? "" : "s"} overdue`}
          value={formatCurrency(data.needsAttention.overdueInvoices.total)}
          sub={
            data.needsAttention.overdueInvoices.count
              ? `oldest ${data.needsAttention.overdueInvoices.oldestDays} days`
              : "none"
          }
          attention={data.needsAttention.overdueInvoices.count > 0}
        />
        <AttentionTile
          label={`${data.needsAttention.waitingQuotes.count} quote${data.needsAttention.waitingQuotes.count === 1 ? "" : "s"} waiting`}
          value={formatCurrency(data.needsAttention.waitingQuotes.total)}
          sub={
            data.needsAttention.waitingQuotes.count
              ? `sent ${data.needsAttention.waitingQuotes.rangeDays[0]}–${data.needsAttention.waitingQuotes.rangeDays[1]} days ago`
              : "none"
          }
        />
        <AttentionTile
          label={`${data.needsAttention.eventsToInvoice.count} event${data.needsAttention.eventsToInvoice.count === 1 ? "" : "s"} to invoice`}
          value={String(data.needsAttention.eventsToInvoice.count)}
          sub={
            data.needsAttention.eventsToInvoice.first
              ? `${data.needsAttention.eventsToInvoice.first.title} — ended ${formatDateRange(data.needsAttention.eventsToInvoice.first.startDate, data.needsAttention.eventsToInvoice.first.endDate)}`
              : "none"
          }
        />
      </div>

      <div className="heading-label mt-5 mb-1.5">Upcoming events</div>
      {data.upcomingEvents.length === 0 ? (
        <p className="text-sm placeholder-text">No upcoming events.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {data.upcomingEvents.map((event) => (
            <Link key={event.id} href={`/events/${event.id}`} className="border border-ink/25 block hover:border-ink">
              <div className="bg-ink/10 h-13" />
              <div className="p-2.5">
                <EventStatusPill status={event.status} />
                <div className="text-[11px] font-semibold mt-1.5">{event.title}</div>
                <div className="text-[9px] placeholder-text mt-0.5">
                  {event.companyName}
                  <br />
                  {formatDateRange(event.startDate, event.endDate)}
                  {event.venues[0] ? ` · ${event.venues[0].name}` : ""}
                </div>
                <div className="rule-thin my-1.5" />
                <div className="flex justify-between text-[9px]">
                  <span className="heading-label">Next milestone</span>
                  <span>{event.milestones[0]?.title ?? "—"}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mt-5">
        <div>
          <div className="heading-label mb-0.5">Latest expenses</div>
          {data.latestExpenses.length === 0 ? (
            <p className="text-sm placeholder-text">No expenses yet.</p>
          ) : (
            data.latestExpenses.map((exp) => (
              <div key={exp.id} className="row grid grid-cols-[1fr_auto] items-center gap-2.5 py-2 border-b border-ink/10 text-[13px]">
                <div>
                  {EXPENSE_CATEGORY_LABEL[exp.category]}{" "}
                  <span className="placeholder-text">· {exp.event?.title ?? "Company overhead"}</span>
                </div>
                <div className="placeholder-text">{formatCurrency(exp.amount)}</div>
              </div>
            ))
          )}
        </div>
        <div>
          <div className="heading-label mb-0.5">Balance</div>
          {data.monthly.length === 0 ? (
            <p className="text-sm placeholder-text">Not enough data yet.</p>
          ) : (
            <div className="flex items-end gap-3 h-14 mt-1.5">
              {data.monthly.map((m) => (
                <div key={m.label} className="flex items-end gap-1 h-full">
                  <div className="bg-ink/25 w-3" style={{ height: `${(m.income / maxMonthly) * 100}%` }} title={`Income ${formatCurrency(m.income)}`} />
                  <div className="bg-accent w-3" style={{ height: `${(m.expense / maxMonthly) * 100}%` }} title={`Expense ${formatCurrency(m.expense)}`} />
                </div>
              ))}
              <span className="heading-label ml-2">Income / expense</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AttentionTile({
  label,
  value,
  sub,
  attention,
}: {
  label: string;
  value: string;
  sub: string;
  attention?: boolean;
}) {
  return (
    <div className="bg-surface px-2.5 py-2.5">
      <div className={`heading-label ${attention ? "text-accent" : ""}`}>{label}</div>
      <div className="text-xl font-semibold tracking-tight mt-0.5">{value}</div>
      <div className="text-[9px] placeholder-text mt-0.5">{sub}</div>
    </div>
  );
}
