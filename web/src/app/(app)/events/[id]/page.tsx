import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canManageFinance } from "@/lib/authz";
import { getEventDetail } from "@/lib/queries/events";
import { formatCurrency, formatDate, formatMinutes } from "@/lib/format";
import { QuoteStatusPill, InvoiceStatusPill } from "@/components/StatusPill";
import { getRunningTimer } from "@/lib/queries/timetracker";
import { startTimerAction } from "@/lib/actions/timetracker";

export default async function EventOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const event = await getEventDetail(user, id);
  if (!event) notFound();

  const totalExpenses = event.expenses.reduce((s, e) => s + e.amount, 0);
  const totalInvoiced = event.invoices.reduce((s, i) => s + i.total, 0);
  const totalMinutes = event.timeEntries.reduce((s, t) => s + t.minutes, 0);
  const upcomingMilestones = event.milestones.filter((m) => m.date >= new Date()).slice(0, 3);
  const uniquePeople = new Set(event.timeEntries.map((t) => t.userId));
  const runningTimer = await getRunningTimer(user.id);

  return (
    <div className="grid grid-cols-[1fr_190px] gap-4">
      <div>
        <div className="label">Brief</div>
        <p className="text-sm mt-1 max-w-prose">{event.brief || <span className="placeholder-text">No brief written yet.</span>}</p>

        <div className="label mt-3.5">Dates</div>
        <Row label="Build / prep" value={event.buildDate ? formatDate(event.buildDate, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"} />
        <Row label="Event days" value={`${formatDate(event.startDate)} – ${formatDate(event.endDate)}`} />
        <Row label="Strike" value={event.strikeDate ? formatDate(event.strikeDate, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"} />

        <div className="label mt-3.5">
          Venues ({event.venues.length}) <span className="placeholder-text normal-case tracking-normal">· addresses link to Google Maps</span>
        </div>
        {event.venues.length === 0 && <p className="text-sm placeholder-text mt-1">No venues added yet.</p>}
        {event.venues.map((v) => (
          <div key={v.id} className="grid grid-cols-[1fr_.8fr_50px] gap-2.5 py-1.5 border-b border-ink/10 text-[13px] items-center">
            <div>{v.name}</div>
            <div className="placeholder-text">{v.note || "—"}</div>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(v.address)}`}
              target="_blank"
              rel="noreferrer"
              className="text-[9px] tracking-[0.1em] uppercase hover:text-accent"
            >
              Map ↗
            </a>
          </div>
        ))}

        <div className="label mt-3.5">Client</div>
        <div className="grid grid-cols-2 gap-2.5 mt-1 text-[13px]">
          <div className="border border-ink/25 p-2">
            <div className="label">Contact</div>
            {event.clientName}
            <div className="placeholder-text text-[11px] mt-0.5">
              {event.clientPhone}
              <br />
              {event.clientEmail}
            </div>
          </div>
          <div className="border border-ink/25 p-2">
            <div className="label">Company</div>
            {event.companyName}
            <div className="placeholder-text text-[11px] mt-0.5">
              {event.companyAddress}
              <br />
              IČO {event.companyIco || "—"} · DIČ {event.companyDic || "—"}
            </div>
          </div>
        </div>

        <div className="label mt-3.5">
          Next milestones <span className="placeholder-text normal-case tracking-normal">· full list on the Milestones tab</span>
        </div>
        {upcomingMilestones.length === 0 && <p className="text-sm placeholder-text mt-1">No upcoming milestones.</p>}
        {upcomingMilestones.map((m) => (
          <div key={m.id} className="grid grid-cols-[70px_1fr] gap-2.5 py-1.5 border-b border-ink/10 text-[13px]">
            <div className="placeholder-text">{formatDate(m.date)}</div>
            <div>{m.title}</div>
          </div>
        ))}
      </div>

      <div className="border-l border-ink/20 pl-3">
        <div className="label">Budget vs actual</div>
        <div className="text-lg font-semibold mt-0.5">{formatCurrency(event.quotedValue)}</div>
        <div className="placeholder-text text-[9px]">quoted value</div>
        <Row label="Expenses" value={formatCurrency(totalExpenses)} />
        <Row label="Invoiced" value={formatCurrency(totalInvoiced)} />
        <Row label="Margin" value={formatCurrency(event.quotedValue - totalExpenses)} strong />

        <div className="rule-thin my-2.5" />
        <div className="label">Time logged</div>
        <div className="text-base font-semibold">{formatMinutes(totalMinutes)}</div>
        <div className="placeholder-text text-[9px]">{uniquePeople.size} people</div>
        {runningTimer?.eventId === event.id ? (
          <div className="btno block text-center mt-2 opacity-50 cursor-default">Timer running here</div>
        ) : (
          <form action={startTimerAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <button type="submit" className="btno block w-full text-center mt-2">
              Start timer
            </button>
          </form>
        )}

        <div className="rule-thin my-2.5" />
        <div className="label">Documents</div>
        {[...event.quotes, ...event.invoices].length === 0 && <p className="text-[12px] placeholder-text mt-1">None yet.</p>}
        {event.quotes.map((q) => (
          <div key={q.id} className="flex justify-between items-center py-1 text-[11px]">
            <span>Quote {q.number}</span>
            <QuoteStatusPill status={q.status} />
          </div>
        ))}
        {event.invoices.map((inv) => (
          <div key={inv.id} className="flex justify-between items-center py-1 text-[11px]">
            <span>Invoice {inv.number}</span>
            <InvoiceStatusPill status={inv.status} dueDate={inv.dueDate} paidAt={inv.paidAt} />
          </div>
        ))}
        <Link href={`/events/${event.id}/quotes`} className="btno block text-center mt-2">
          View quotes & invoices
        </Link>
        {canManageFinance(user) && (
          <Link href={`/finance/quotes/new?eventId=${event.id}`} className="btn block text-center mt-1.5">
            New quote for this event
          </Link>
        )}

        <div className="rule-thin my-2.5" />
        <div className="label">Team</div>
        <div className="flex gap-1 mt-1 flex-wrap">
          {event.members.length === 0 && <span className="text-[11px] placeholder-text">Owner only ({event.owner.name})</span>}
          {event.members.map((m) => (
            <div key={m.id} className="w-[18px] h-[18px] bg-ink/10 flex items-center justify-center text-[8px]" title={m.user.name}>
              {m.user.name.slice(0, 1)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 text-[13px] ${strong ? "font-semibold" : "border-b border-ink/10"}`}>
      <div>{label}</div>
      <div className={strong ? "" : "placeholder-text"}>{value}</div>
    </div>
  );
}
