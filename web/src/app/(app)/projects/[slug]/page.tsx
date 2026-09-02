import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canManageFinance, canViewProjectBudget } from "@/lib/authz";
import { getProjectDetail, resolveProjectIdByNumber } from "@/lib/queries/projects";
import { parseProjectSlug, projectHref, clientHref } from "@/lib/slug";
import { resolveProjectBudget } from "@/lib/project-budget";
import { formatCurrency, formatDate, formatDateRange, formatMinutes } from "@/lib/format";
import { QuoteStatusPill, InvoiceStatusPill } from "@/components/StatusPill";
import { ProjectTimerButton } from "@/components/projects/ProjectTimerButton";
import { getRunningTimer, getOverviewUsers } from "@/lib/queries/timetracker";
import { getLocale, getDictionary } from "@/lib/i18n";

const DATE_TIME: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };

/** Whole calendar days from today (local) to `date` — negative if past, 0 if today. */
function daysFromToday(date: Date | null): number | null {
  if (!date) return null;
  const a = new Date();
  a.setHours(0, 0, 0, 0);
  const b = new Date(date);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export default async function EventOverviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const number = parseProjectSlug(slug);
  if (!number) notFound();
  const id = await resolveProjectIdByNumber(number);
  if (!id) notFound();
  const project = await getProjectDetail(user, id);
  if (!project) notFound();
  const t = getDictionary(await getLocale());
  const te = t.projects;

  const totalExpenses = project.expenses.reduce((s, e) => s + e.amount, 0);
  const totalMinutes = project.timeEntries.reduce((s, e) => s + e.minutes, 0);
  const upcomingItems = project.roadmapItems.filter((m) => m.date >= new Date()).slice(0, 3);
  const uniquePeople = new Set(project.timeEntries.map((e) => e.userId));
  const runningTimer = await getRunningTimer(user.id);
  const allUserIds = (await getOverviewUsers()).map((u) => u.id).join(",");

  const showFinance = canViewProjectBudget(user);
  const budget = resolveProjectBudget(project);
  const actualMargin = project.quotedValue - totalExpenses;
  const spentPct = budget.amount && budget.amount > 0 ? Math.round((totalExpenses / budget.amount) * 100) : null;

  const buildTarget = project.buildDate ?? project.startDate;
  const buildDays = daysFromToday(buildTarget);

  return (
    <div className="grid grid-cols-1 gap-5">
      {/* stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label={te.stats.buildDay} value={te.stats.buildRelative(buildDays)} sub={formatDate(buildTarget, DATE_TIME)} />
        <Stat label={te.stats.timeLogged} value={formatMinutes(totalMinutes)} sub={te.peopleCount(uniquePeople.size)} />
        <Stat label={te.tabRoadmap} value={String(upcomingItems.length)} sub={te.nextMilestones} />
        <Stat label={te.documents} value={String(project.quotes.length + project.invoices.length)} sub="" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5 items-start">
        {/* left column */}
        <div className="flex flex-col gap-4">
          <section className="card p-5">
            <div className="heading-label">{te.brief}</div>
            <p className="text-sm mt-2 max-w-prose leading-relaxed">
              {project.brief || <span className="placeholder-text">{te.noBrief}</span>}
            </p>
          </section>

          <section className="card p-5">
            <div className="heading-label mb-4">{te.dates}</div>
            <Timeline
              nodes={[
                { label: te.buildPrep, date: project.buildDate, display: project.buildDate ? formatDate(project.buildDate, DATE_TIME) : "—" },
                { label: te.projectDays, date: project.startDate, display: formatDateRange(project.startDate, project.endDate) },
                { label: te.strike, date: project.strikeDate, display: project.strikeDate ? formatDate(project.strikeDate, DATE_TIME) : "—" },
              ]}
            />
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="heading-label">{te.venuesCount(project.venues.length)}</span>
              <span className="text-[8px] tracking-[0.14em] uppercase placeholder-text">{te.venuesMapsNote.replace(/^·\s*/, "")}</span>
            </div>
            {project.venues.length === 0 && <p className="text-sm placeholder-text mt-1">{te.noVenues}</p>}
            {project.venues.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-3 py-2.5 border-t border-ink/8 first:border-t-0 text-[13px]">
                <div className="min-w-0">
                  <div className="truncate">{v.name}</div>
                  {v.note && <div className="placeholder-text text-[11px]">{v.note}</div>}
                </div>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(v.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[9px] tracking-[0.1em] uppercase placeholder-text hover:text-accent shrink-0"
                >
                  {te.mapLink}
                </a>
              </div>
            ))}
          </section>

          <section className="card p-5">
            <div className="heading-label mb-3">{te.client}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-ink/4 border border-ink/8 p-3.5">
                <div className="label">{te.contactsCount(project.contacts.length)}</div>
                {project.contacts.length === 0 && <p className="placeholder-text text-[11px] mt-1">{te.noneOnFile}</p>}
                {project.contacts.map((c) => (
                  <div key={c.id} className="mt-1.5 first:mt-2 text-[13px]">
                    <div className="font-medium">{c.name}</div>
                    <div className="placeholder-text text-[11px]">
                      {[c.phone, c.email].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-ink/4 border border-ink/8 p-3.5">
                <div className="label">{te.company}</div>
                <div className="font-medium text-[13px] mt-2">
                  {project.clientId ? (
                    <Link href={clientHref({ id: project.clientId, name: project.companyName })} className="hover:text-accent">
                      {project.companyName}
                    </Link>
                  ) : (
                    project.companyName
                  )}
                </div>
                <div className="placeholder-text text-[11px] mt-0.5">
                  {project.companyAddress}
                  {project.companyAddress && <br />}
                  {te.icoDicLine(project.companyIco || "—", project.companyDic || "—")}
                </div>
              </div>
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="heading-label">{te.nextMilestones}</span>
              <Link href={projectHref(project, "/roadmap")} className="text-[9px] tracking-[0.1em] uppercase placeholder-text hover:text-accent">
                {te.tabRoadmap}
              </Link>
            </div>
            {upcomingItems.length === 0 && <p className="text-sm placeholder-text mt-1">{te.noUpcomingMilestones}</p>}
            {upcomingItems.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 py-2.5 border-t border-ink/8 first:border-t-0 text-[13px]">
                <div>{m.title}</div>
                <div className="placeholder-text text-[11px] shrink-0">{formatDate(m.date, DATE_TIME)}</div>
              </div>
            ))}
          </section>
        </div>

        {/* right rail */}
        <div className="flex flex-col gap-4">
          {showFinance && (
            <Link href={projectHref(project, "/finance")} className="card p-4 block hover:border-ink/25 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className="heading-label !text-[9px]">{te.finance.snapshotHeading}</span>
                <span className="text-[8px] tracking-[0.14em] uppercase font-semibold text-accent">{te.finance.openFinance}</span>
              </div>
              <div className="flex justify-between py-1 text-[13px]">
                <span className="text-ink/72">{te.finance.snapshotBudget}</span>
                <span className="font-semibold tabular-nums">{budget.amount === null ? "—" : formatCurrency(budget.amount)}</span>
              </div>
              <div className="flex justify-between py-1 text-[13px]">
                <span className="text-ink/72">{te.finance.snapshotSpent}</span>
                <span className="tabular-nums">
                  {formatCurrency(totalExpenses)}
                  {spentPct !== null && <span className="placeholder-text"> · {spentPct}%</span>}
                </span>
              </div>
              <div className="flex justify-between py-1 text-[13px]">
                <span className="text-ink/72">{te.finance.snapshotMargin}</span>
                <span className={`font-semibold tabular-nums ${actualMargin >= 0 ? "text-positive" : "text-warning"}`}>
                  {formatCurrency(actualMargin)}
                </span>
              </div>
            </Link>
          )}

          <div className="card p-4">
            <div className="flex items-center justify-between">
              <span className="heading-label !text-[9px]">{te.timeLogged}</span>
              <Link
                href={`/time-tracker/report?events=${project.id}&users=${allUserIds}`}
                className="text-[8px] tracking-[0.14em] uppercase font-semibold placeholder-text hover:text-accent"
              >
                {te.showAllLogs}
              </Link>
            </div>
            <div className="flex items-end justify-between mt-1">
              <div>
                <div className="text-lg font-semibold">{formatMinutes(totalMinutes)}</div>
                <div className="placeholder-text text-[10px]">{te.peopleCount(uniquePeople.size)}</div>
              </div>
              <ProjectTimerButton
                projectId={project.id}
                running={runningTimer?.projectId === project.id}
                startLabel={te.startTimer}
                stopLabel={te.stopTimer}
                discardedMessage={t.timeTracker.runningTimer.discardedTooShort}
              />
            </div>
          </div>

          {showFinance && (
            <div className="card p-4">
              <div className="heading-label !text-[9px] mb-1.5">{te.documents}</div>
              {[...project.quotes, ...project.invoices].length === 0 && <p className="text-[12px] placeholder-text">{te.noneYet}</p>}
              {project.quotes.map((q) => (
                <div key={q.id} className="flex justify-between items-center py-1.5 text-[12px] border-t border-ink/8 first:border-t-0">
                  <span>{te.quoteNumber(q.number)}</span>
                  <QuoteStatusPill status={q.status} t={t.statusQuote} />
                </div>
              ))}
              {project.invoices.map((inv) => (
                <div key={inv.id} className="flex justify-between items-center py-1.5 text-[12px] border-t border-ink/8 first:border-t-0">
                  <span>{te.invoiceNumber(inv.number)}</span>
                  <InvoiceStatusPill status={inv.status} dueDate={inv.dueDate} paidAt={inv.paidAt} t={t.invoicePill} />
                </div>
              ))}
              <Link href={projectHref(project, "/finance")} className="btno block text-center mt-3">
                {te.viewQuotesInvoices}
              </Link>
              {canManageFinance(user) && (
                <Link href={`/finance/quotes/new?projectId=${project.id}`} className="btn font-semibold block text-center mt-1.5">
                  {te.newQuoteForProject}
                </Link>
              )}
            </div>
          )}

          <div className="card p-4">
            <div className="heading-label !text-[9px] mb-1.5">{te.team}</div>
            <div className="flex gap-1.5 flex-wrap">
              {project.members.length === 0 && <span className="text-[11px] placeholder-text">{te.ownerOnly(project.owner.name)}</span>}
              {project.members.map((m) => (
                <div
                  key={m.id}
                  className="w-[26px] h-[26px] rounded-[8px] bg-accent/16 text-accent border border-accent/20 flex items-center justify-center text-[10px] font-bold"
                  title={m.user.name}
                >
                  {m.user.name.slice(0, 1)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "positive" | "attention" | "warning" }) {
  const valueClass =
    tone === "positive" ? "text-positive" : tone === "attention" ? "text-attention" : tone === "warning" ? "text-warning" : "";
  return (
    <div className="card px-4 py-3.5">
      <div className="heading-label !text-[8px]">{label}</div>
      <div className={`text-[19px] font-semibold tracking-tight mt-1.5 ${valueClass}`}>{value}</div>
      {sub && <div className="placeholder-text text-[10px] mt-0.5">{sub}</div>}
    </div>
  );
}

function Timeline({ nodes }: { nodes: { label: string; date: Date | null; display: string }[] }) {
  const now = new Date();
  const doneCount = nodes.filter((n) => n.date && n.date < now).length;
  const fillPct = doneCount >= 3 ? 100 : doneCount === 2 ? 50 : doneCount === 1 ? 16 : 0;
  return (
    <div className="relative flex px-1.5 pt-1.5">
      <div className="absolute left-11 right-11 top-[11px] h-0.5 bg-ink/14" />
      <div className="absolute left-11 top-[11px] h-0.5 bg-accent" style={{ width: `${fillPct}%` }} />
      {nodes.map((n, i) => {
        const done = Boolean(n.date && n.date < now);
        return (
          <div key={i} className="flex-1 text-center relative">
            <div
              className={`w-3 h-3 rounded-full mx-auto mb-2.5 border-2 ${
                done ? "bg-accent border-accent" : "bg-bg border-ink/55"
              }`}
            />
            <div className="text-[9px] tracking-[0.12em] uppercase placeholder-text">{n.label}</div>
            <div className="text-[12px] mt-0.5">{n.display}</div>
          </div>
        );
      })}
    </div>
  );
}
