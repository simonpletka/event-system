import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canManageFinance } from "@/lib/authz";
import { getEventDetail } from "@/lib/queries/events";
import { formatCurrency, formatDate, formatMinutes } from "@/lib/format";
import { QuoteStatusPill, InvoiceStatusPill } from "@/components/StatusPill";
import { getRunningTimer } from "@/lib/queries/timetracker";
import { startTimerAction } from "@/lib/actions/timetracker";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function EventOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const event = await getEventDetail(user, id);
  if (!event) notFound();
  const t = getDictionary(await getLocale());
  const te = t.events;

  const totalExpenses = event.expenses.reduce((s, e) => s + e.amount, 0);
  const totalInvoiced = event.invoices.reduce((s, i) => s + i.total, 0);
  const totalMinutes = event.timeEntries.reduce((s, t) => s + t.minutes, 0);
  const upcomingMilestones = event.milestones.filter((m) => m.date >= new Date()).slice(0, 3);
  const uniquePeople = new Set(event.timeEntries.map((t) => t.userId));
  const runningTimer = await getRunningTimer(user.id);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-5">
      <div>
        <div className="label">{te.brief}</div>
        <p className="text-sm mt-1 max-w-prose">{event.brief || <span className="placeholder-text">{te.noBrief}</span>}</p>

        <div className="label mt-3.5">{te.dates}</div>
        <Row label={te.buildPrep} value={event.buildDate ? formatDate(event.buildDate, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"} />
        <Row label={te.eventDays} value={`${formatDate(event.startDate)} – ${formatDate(event.endDate)}`} />
        <Row label={te.strike} value={event.strikeDate ? formatDate(event.strikeDate, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"} />

        <div className="label mt-3.5">
          {te.venuesCount(event.venues.length)} <span className="placeholder-text normal-case tracking-normal">{te.venuesMapsNote}</span>
        </div>
        {event.venues.length === 0 && <p className="text-sm placeholder-text mt-1">{te.noVenues}</p>}
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
              {te.mapLink}
            </a>
          </div>
        ))}

        <div className="label mt-3.5">{te.client}</div>
        <div className="grid grid-cols-2 gap-2.5 mt-1 text-[13px]">
          <div className="card p-3">
            <div className="label mb-1">{te.contactsCount(event.contacts.length)}</div>
            {event.contacts.length === 0 && <p className="placeholder-text text-[11px]">{te.noneOnFile}</p>}
            {event.contacts.map((c) => (
              <div key={c.id} className="mb-1.5 last:mb-0">
                {c.name}
                <div className="placeholder-text text-[11px]">
                  {c.phone}
                  {c.phone && c.email ? " · " : ""}
                  {c.email}
                </div>
              </div>
            ))}
          </div>
          <div className="card p-3">
            <div className="label">{te.company}</div>
            {event.companyName}
            <div className="placeholder-text text-[11px] mt-0.5">
              {event.companyAddress}
              <br />
              {te.icoDicLine(event.companyIco || "—", event.companyDic || "—")}
            </div>
          </div>
        </div>

        <div className="label mt-3.5">
          {te.nextMilestones} <span className="placeholder-text normal-case tracking-normal">{te.fullListNote}</span>
        </div>
        {upcomingMilestones.length === 0 && <p className="text-sm placeholder-text mt-1">{te.noUpcomingMilestones}</p>}
        {upcomingMilestones.map((m) => (
          <div key={m.id} className="grid grid-cols-[70px_1fr] gap-2.5 py-1.5 border-b border-ink/10 text-[13px]">
            <div className="placeholder-text">{formatDate(m.date)}</div>
            <div>{m.title}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="card px-4 py-4">
          <div className="heading-label">{te.budgetVsActual}</div>
          <div className="text-2xl font-semibold tracking-tight mt-1">{formatCurrency(event.quotedValue)}</div>
          <div className="placeholder-text text-[10px]">{te.quotedValue}</div>
          <div className="mt-2">
            <Row label={te.expenses} value={formatCurrency(totalExpenses)} />
            <Row label={te.invoiced} value={formatCurrency(totalInvoiced)} />
            <Row label={te.margin} value={formatCurrency(event.quotedValue - totalExpenses)} strong />
          </div>
        </div>

        <div className="card px-4 py-4">
          <div className="heading-label">{te.timeLogged}</div>
          <div className="text-lg font-semibold mt-1">{formatMinutes(totalMinutes)}</div>
          <div className="placeholder-text text-[10px]">{te.peopleCount(uniquePeople.size)}</div>
          {runningTimer?.eventId === event.id ? (
            <div className="btno block text-center mt-3 opacity-50 cursor-default">{te.timerRunningHere}</div>
          ) : (
            <form action={startTimerAction}>
              <input type="hidden" name="eventId" value={event.id} />
              <button type="submit" className="btno block w-full text-center mt-3">
                {te.startTimer}
              </button>
            </form>
          )}
        </div>

        <div className="card px-4 py-4">
          <div className="heading-label mb-1.5">{te.documents}</div>
          {[...event.quotes, ...event.invoices].length === 0 && <p className="text-[12px] placeholder-text">{te.noneYet}</p>}
          {event.quotes.map((q) => (
            <div key={q.id} className="flex justify-between items-center py-1.5 text-[12px]">
              <span>{te.quoteNumber(q.number)}</span>
              <QuoteStatusPill status={q.status} t={t.statusQuote} />
            </div>
          ))}
          {event.invoices.map((inv) => (
            <div key={inv.id} className="flex justify-between items-center py-1.5 text-[12px]">
              <span>{te.invoiceNumber(inv.number)}</span>
              <InvoiceStatusPill status={inv.status} dueDate={inv.dueDate} paidAt={inv.paidAt} t={t.invoicePill} />
            </div>
          ))}
          <Link href={`/events/${event.id}/quotes`} className="btno block text-center mt-3">
            {te.viewQuotesInvoices}
          </Link>
          {canManageFinance(user) && (
            <Link href={`/finance/quotes/new?eventId=${event.id}`} className="btn font-semibold block text-center mt-1.5">
              {te.newQuoteForEvent}
            </Link>
          )}
        </div>

        <div className="card px-4 py-4">
          <div className="heading-label mb-1.5">{te.team}</div>
          <div className="flex gap-1.5 flex-wrap">
            {event.members.length === 0 && <span className="text-[11px] placeholder-text">{te.ownerOnly(event.owner.name)}</span>}
            {event.members.map((m) => (
              <div
                key={m.id}
                className="w-[26px] h-[26px] rounded-[9px] bg-ink/10 border border-ink/14 flex items-center justify-center text-[10px] font-semibold"
                title={m.user.name}
              >
                {m.user.name.slice(0, 1)}
              </div>
            ))}
          </div>
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
