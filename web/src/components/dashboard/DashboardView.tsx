"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProjectStatus } from "@/generated/prisma/enums";
import type { DashProject } from "@/lib/dashboard-types";
import { toggleRoadmapItemDoneAction } from "@/lib/actions/roadmap";
import { ProjectStatusPill } from "@/components/StatusPill";
import { formatCurrency } from "@/lib/format";
import {
  formatMonthKey,
  formatPragueDate,
  formatPragueRange,
  monthGridKeys,
  pragueDateKey,
  shiftMonth,
} from "@/lib/prague-date";
import { getDictionary, type Dictionary, type Locale } from "@/lib/dictionary";

type T = Dictionary["dashboard"];

export type DashTask = { id: string; title: string; date: string; projectTitle: string; projectHref: string; editable: boolean };
export type DashMeeting = { key: string; id: string; title: string; allDay: boolean; date: string };
export type DashExpense = { id: string; note: string; category: string; amount: number; date: string; project: DashProject | null };
export type DashFinance = {
  overdue: { count: number; total: number };
  quotes: { count: number; total: number };
  toInvoice: { count: number; first: string | null };
  cashflow: { month: string; invoiced: number; paid: number; outstanding: number; expenses: number };
};

export type DashboardViewProps = {
  locale: Locale;
  today: string;
  upcoming: DashProject[];
  month: { key: string; projects: DashProject[] };
  loadMonth: (month: string) => Promise<DashProject[]>;
  tasks: DashTask[];
  meetings: DashMeeting[] | null;
  canCreateMeeting: boolean;
  finance: DashFinance | null;
  expenses: DashExpense[] | null;
};

/**
 * The dashboard's interactive body. Selection is held here, not in each
 * section, so "View project" on an expense can open that project in the
 * Projects section even when it isn't in the upcoming list.
 */
export function DashboardView(props: DashboardViewProps) {
  const t = getDictionary(props.locale);
  const [selected, setSelected] = useState<DashProject | null>(null);
  const projectsRef = useRef<HTMLElement>(null);

  function showProject(project: DashProject) {
    setSelected(project);
    projectsRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex flex-col gap-6">
      <ProjectsSection ref={projectsRef} {...props} selected={selected} onSelect={setSelected} t={t} />
      <div className={`grid grid-cols-1 gap-6 ${props.finance ? "md:grid-cols-2" : ""}`}>
        <TasksSection tasks={props.tasks} meetings={props.meetings} canCreateMeeting={props.canCreateMeeting} locale={props.locale} t={t.dashboard} />
        {props.finance && <FinanceSection finance={props.finance} locale={props.locale} t={t.dashboard} />}
      </div>
      {props.expenses && <ExpensesSection expenses={props.expenses} locale={props.locale} t={t} onViewProject={showProject} />}
    </div>
  );
}

/* --- shared bits ------------------------------------------------------------ */

function Section({
  title,
  sub,
  action,
  children,
  ref,
  label,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  ref?: React.Ref<HTMLElement>;
  label: string;
}) {
  return (
    <section ref={ref} aria-label={label} className="card p-4 md:p-5 min-w-0 scroll-mt-28">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div className="min-w-0">
          <h2 className="heading-label !text-[12px] font-bold">{title}</h2>
          {sub && <p className="text-[12.5px] placeholder-text mt-1">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] placeholder-text">{children}</p>;
}

/** Left-bar colour per status, matching the calendar legend. */
const STATUS_BAR: Record<ProjectStatus, string> = {
  IN_PROGRESS: "var(--color-attention)",
  CONFIRMED: "var(--color-positive)",
  INQUIRY: "color-mix(in srgb, var(--color-ink) 45%, transparent)",
  QUOTE_SENT: "color-mix(in srgb, var(--color-ink) 45%, transparent)",
  TO_INVOICE: "var(--color-warning)",
  CLOSED: "color-mix(in srgb, var(--color-ink) 22%, transparent)",
  CANCELLED: "color-mix(in srgb, var(--color-ink) 22%, transparent)",
};

/* --- Projects & this week ---------------------------------------------------- */

function ProjectsSection({
  ref,
  locale,
  today,
  upcoming,
  month,
  loadMonth,
  selected,
  onSelect,
  t,
}: DashboardViewProps & {
  ref: React.Ref<HTMLElement>;
  selected: DashProject | null;
  onSelect: (project: DashProject | null) => void;
  t: Dictionary;
}) {
  const td = t.dashboard;
  const [view, setView] = useState<"list" | "calendar">("list");

  return (
    <Section
      ref={ref}
      label={td.projectsThisWeek}
      title={td.projectsThisWeek}
      sub={view === "list" ? td.projectsFromToday : undefined}
      action={
        <div role="tablist" className="inline-flex p-1 rounded-full border border-ink/16 bg-ink/5">
          {(["list", "calendar"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-full text-[11px] font-semibold tracking-[0.1em] uppercase transition-colors ${
                view === v ? "bg-ink/[0.16] text-ink" : "text-ink/55 hover:text-ink/80"
              }`}
            >
              {v === "list" ? td.viewList : td.viewCalendar}
            </button>
          ))}
        </div>
      }
    >
      <div className={`grid grid-cols-1 gap-4 ${selected ? "lg:grid-cols-[minmax(0,1fr)_300px]" : ""}`}>
        <div className="min-w-0">
          {view === "list" ? (
            <ProjectList projects={upcoming} selectedId={selected?.id ?? null} onSelect={onSelect} locale={locale} t={t} />
          ) : (
            <MonthCalendar
              initial={month}
              today={today}
              loadMonth={loadMonth}
              selectedId={selected?.id ?? null}
              onSelect={onSelect}
              locale={locale}
              t={td}
              todayLabel={t.calendar.today}
            />
          )}
        </div>
        {selected && <ProjectDetail project={selected} onClose={() => onSelect(null)} locale={locale} t={td} />}
      </div>
    </Section>
  );
}

function ProjectList({
  projects,
  selectedId,
  onSelect,
  locale,
  t,
}: {
  projects: DashProject[];
  selectedId: string | null;
  onSelect: (project: DashProject) => void;
  locale: Locale;
  t: Dictionary;
}) {
  if (projects.length === 0) return <Empty>{t.dashboard.noUpcomingProjects}</Empty>;
  return (
    <ul className="flex flex-col">
      {projects.map((p) => (
        <li key={p.id} className="border-t border-ink/8 first:border-t-0">
          <button
            type="button"
            onClick={() => onSelect(p)}
            aria-pressed={selectedId === p.id}
            className={`w-full text-left flex items-center gap-3 py-3 px-2 -mx-2 rounded-lg transition-colors hover:bg-ink/5 ${
              selectedId === p.id ? "bg-ink/[0.07]" : ""
            }`}
          >
            <span className="w-[74px] shrink-0 font-mono text-[11px] text-ink/55 whitespace-nowrap">
              {formatPragueDate(p.start, locale, { day: "numeric", month: "short" })}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold truncate">{p.title}</span>
              <span className="block text-[12px] placeholder-text truncate">
                {p.client}
                {p.venue ? ` · ${p.venue}` : ""}
              </span>
            </span>
            <span className="shrink-0">
              <ProjectStatusPill status={p.status} t={t.statusProject} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function MonthCalendar({
  initial,
  today,
  loadMonth,
  selectedId,
  onSelect,
  locale,
  t,
  todayLabel,
}: {
  initial: { key: string; projects: DashProject[] };
  today: string;
  loadMonth: (month: string) => Promise<DashProject[]>;
  selectedId: string | null;
  onSelect: (project: DashProject) => void;
  locale: Locale;
  t: T;
  todayLabel: string;
}) {
  const [month, setMonth] = useState(initial.key);
  const [cache, setCache] = useState<Record<string, DashProject[]>>({ [initial.key]: initial.projects });
  const [failed, setFailed] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const projects = cache[month];

  function go(next: string) {
    setMonth(next);
    setFailed(null);
    if (cache[next]) return;
    startTransition(async () => {
      try {
        const loaded = await loadMonth(next);
        setCache((c) => ({ ...c, [next]: loaded }));
      } catch {
        setFailed(next);
      }
    });
  }

  // Day keys per project, in Prague time, computed once per render of this month.
  const spans = (projects ?? []).map((p) => ({ p, from: pragueDateKey(p.start), to: pragueDateKey(p.end) }));
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale === "cs" ? "cs-CZ" : "en-GB", { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 10, 2 + i)))
  );
  const legend: [string, string][] = [
    [t.legendInProgress, STATUS_BAR.IN_PROGRESS],
    [t.legendConfirmed, STATUS_BAR.CONFIRMED],
    [t.legendInquiry, STATUS_BAR.INQUIRY],
    [t.legendToInvoice, STATUS_BAR.TO_INVOICE],
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div className="flex items-center gap-1.5">
          <button type="button" className="btno !px-2.5" aria-label={t.previousMonth} onClick={() => go(shiftMonth(month, -1))}>
            ←
          </button>
          <button type="button" className="btno !px-2.5" aria-label={t.nextMonth} onClick={() => go(shiftMonth(month, 1))}>
            →
          </button>
          <button type="button" className="btno" onClick={() => go(today.slice(0, 7))}>
            {todayLabel}
          </button>
        </div>
        <h3 className="text-[15px] font-semibold capitalize" aria-live="polite">
          {formatMonthKey(month, locale)}
        </h3>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3 text-[11.5px] placeholder-text" aria-label="Legend">
        {legend.map(([label, color]) => (
          <li key={label} className="flex items-center gap-1.5">
            <span className="w-[3px] h-3 rounded-full" style={{ background: color }} />
            {label}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-accent text-white text-[9px] font-bold grid place-items-center">{Number(today.slice(8))}</span>
          {t.legendToday}
        </li>
      </ul>

      {failed === month ? (
        <p className="text-[13px] text-warning">{t.monthLoadFailed}</p>
      ) : !projects ? (
        <p className="text-[13px] placeholder-text">{pending ? t.loadingMonth : ""}</p>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden border border-ink/10 bg-ink/10" role="grid" aria-label={formatMonthKey(month, locale)}>
            {weekdays.map((d) => (
              <div key={d} role="columnheader" className="bg-surface px-1 py-1.5 text-center text-[10px] uppercase tracking-[0.08em] placeholder-text">
                {d}
              </div>
            ))}
            {monthGridKeys(month).map((key, i) => {
              if (!key) return <div key={`blank-${i}`} className="bg-surface/60 min-h-[64px] md:min-h-[86px]" />;
              const dayProjects = spans.filter((s) => s.from <= key && key <= s.to).map((s) => s.p);
              const isToday = key === today;
              return (
                <div key={key} role="gridcell" data-date={key} className="bg-surface min-h-[64px] md:min-h-[86px] p-1 min-w-0 flex flex-col gap-1">
                  <span
                    className={`self-end text-[10.5px] tabular-nums w-5 h-5 grid place-items-center rounded-full ${
                      isToday ? "bg-accent text-white font-bold" : "placeholder-text"
                    }`}
                    aria-current={isToday ? "date" : undefined}
                  >
                    {Number(key.slice(8))}
                  </span>
                  {dayProjects.slice(0, 3).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onSelect(p)}
                      title={p.title}
                      aria-pressed={selectedId === p.id}
                      className={`w-full min-w-0 text-left text-[10.5px] leading-tight truncate rounded-[5px] pl-1.5 pr-1 py-[3px] border-l-[3px] transition-colors ${
                        selectedId === p.id ? "bg-ink/20" : "bg-ink/[0.07] hover:bg-ink/[0.13]"
                      }`}
                      style={{ borderLeftColor: STATUS_BAR[p.status] }}
                    >
                      {p.title}
                    </button>
                  ))}
                  {dayProjects.length > 3 && <span className="text-[10px] placeholder-text pl-1">+{dayProjects.length - 3}</span>}
                </div>
              );
            })}
          </div>
          {projects.length === 0 && <p className="text-[12.5px] placeholder-text mt-3">{t.noProjectsThisMonth}</p>}
        </>
      )}
    </div>
  );
}

function ProjectDetail({ project, onClose, locale, t }: { project: DashProject; onClose: () => void; locale: Locale; t: T }) {
  const rows: [string, string][] = [
    [t.detailClient, project.client],
    [t.detailDates, formatPragueRange(project.start, project.end, locale)],
    [t.detailPlace, project.venue ?? t.noPlace],
    [
      t.nextMilestone,
      project.nextMilestone
        ? `${project.nextMilestone.title} · ${formatPragueDate(project.nextMilestone.date, locale, { day: "numeric", month: "short" })}`
        : t.noMilestone,
    ],
  ];
  return (
    <aside aria-label={project.title} className="rounded-xl border border-ink/12 bg-ink/[0.04] p-4 min-w-0 self-start">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-semibold leading-snug min-w-0 break-words">{project.title}</h3>
        <button type="button" onClick={onClose} aria-label={t.closeDetail} className="btno !px-2 !py-1 text-[10px] shrink-0">
          ✕
        </button>
      </div>
      <dl className="mt-3 flex flex-col gap-2.5 text-[12.5px]">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="heading-label !text-[9.5px]">{k}</dt>
            <dd className="mt-0.5 break-words">{v}</dd>
          </div>
        ))}
      </dl>
      <Link href={project.href} className="btn mt-4 inline-block">
        {t.openProject}
      </Link>
    </aside>
  );
}

/* --- Tasks & meetings --------------------------------------------------------- */

const SOON_MS = 3 * 86_400_000;

function TasksSection({
  tasks,
  meetings,
  canCreateMeeting,
  locale,
  t,
}: {
  tasks: DashTask[];
  meetings: DashMeeting[] | null;
  canCreateMeeting: boolean;
  locale: Locale;
  t: T;
}) {
  const router = useRouter();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const [now] = useState(() => new Date().getTime());
  const open = tasks.filter((task) => !done.has(task.id));

  function complete(task: DashTask) {
    setDone((d) => new Set(d).add(task.id));
    const formData = new FormData();
    formData.set("id", task.id);
    startTransition(async () => {
      await toggleRoadmapItemDoneAction(formData);
      router.refresh();
    });
  }

  return (
    <Section label={t.tasksMeetings} title={t.tasksMeetings}>
      <h3 className="heading-label !text-[10px] mb-2">{t.openTasks}</h3>
      {open.length === 0 ? (
        <Empty>{t.noOpenTasks}</Empty>
      ) : (
        <ul className="flex flex-col">
          {open.map((task) => {
            const due = new Date(task.date).getTime();
            const chip = due < now ? ["warning", t.taskOverdue] : due - now <= SOON_MS ? ["attention", t.dueSoon] : ["neutral", t.taskUpcoming];
            return (
              <li key={task.id} className="flex items-center gap-2.5 py-2.5 border-t border-ink/8 first:border-t-0 text-[13px]">
                <input
                  type="checkbox"
                  className="shrink-0 w-4 h-4 accent-[var(--color-accent)]"
                  disabled={!task.editable}
                  onChange={() => complete(task)}
                  aria-label={t.markTaskDone(task.title)}
                />
                <Link href={task.projectHref} className="min-w-0 flex-1 hover:text-accent">
                  <span className="block truncate">{task.title}</span>
                  <span className="block text-[11.5px] placeholder-text truncate">{task.projectTitle}</span>
                </Link>
                <span className={`tag tag-${chip[0]} shrink-0`}>{chip[1]}</span>
                <span className="font-mono text-[11px] text-ink/55 whitespace-nowrap shrink-0">
                  {formatPragueDate(task.date, locale, { day: "numeric", month: "short" })}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {meetings && (
        <div className="mt-5 pt-4 border-t border-ink/10">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="heading-label !text-[10px]">{t.meetings}</h3>
            {canCreateMeeting && (
              <Link href="/meetings/new" className="btno text-[10px]">
                {t.newMeeting}
              </Link>
            )}
          </div>
          {meetings.length === 0 ? (
            <Empty>{t.noMeetings}</Empty>
          ) : (
            <ul className="flex flex-col">
              {meetings.map((m) => (
                <li key={m.key} className="border-t border-ink/8 first:border-t-0">
                  <Link href={`/meetings/${m.id}`} className="flex items-center gap-2.5 py-2.5 text-[13px] hover:text-accent">
                    <span className="min-w-0 flex-1 truncate">{m.title}</span>
                    <span className="font-mono text-[11px] text-ink/55 whitespace-nowrap">
                      {formatPragueDate(m.date, locale, m.allDay ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {m.allDay ? ` · ${t.allDay}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Section>
  );
}

/* --- Finance ----------------------------------------------------------------- */

function FinanceSection({ finance, locale, t }: { finance: DashFinance; locale: Locale; t: T }) {
  const { overdue, quotes, toInvoice, cashflow } = finance;
  const bars: [string, number, string][] = [
    [t.invoiced, cashflow.invoiced, "color-mix(in srgb, var(--color-ink) 60%, transparent)"],
    [t.paid, cashflow.paid, "var(--color-positive)"],
    [t.outstanding, cashflow.outstanding, "var(--color-attention)"],
    [t.expensesLabel, cashflow.expenses, "var(--color-warning)"],
  ];
  const max = Math.max(1, ...bars.map((b) => b[1]));

  return (
    <Section label={t.finance} title={t.finance}>
      <Link
        href="/finance/invoices?bucket=overdue"
        className={`block rounded-xl p-4 border transition-colors ${
          overdue.count > 0 ? "border-warning/45 bg-warning/10 hover:bg-warning/15" : "border-ink/12 bg-ink/[0.04] hover:bg-ink/[0.07]"
        }`}
      >
        <div className="heading-label !text-[10px]">{t.overdueInvoicesLabel}</div>
        <div className={`text-[26px] font-bold tracking-tight tabular-nums mt-1.5 ${overdue.count > 0 ? "text-warning" : ""}`}>
          {formatCurrency(overdue.total)}
        </div>
        <div className="text-[11.5px] placeholder-text mt-1">{overdue.count > 0 ? t.overdueCount(overdue.count) : t.noOverdue}</div>
      </Link>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <Link href="/finance/quotes?status=SENT" className="rounded-xl p-3.5 border border-ink/12 hover:bg-ink/[0.05] min-w-0">
          <div className="heading-label !text-[9.5px]">{t.quotesAwaiting}</div>
          <div className="text-[18px] font-bold tabular-nums mt-1.5">{formatCurrency(quotes.total)}</div>
          <div className="text-[11px] placeholder-text mt-0.5">{quotes.count ? t.quotesSentCount(quotes.count) : t.nothingWaiting}</div>
        </Link>
        <Link href="/projects?status=TO_INVOICE" className="rounded-xl p-3.5 border border-ink/12 hover:bg-ink/[0.05] min-w-0">
          <div className="heading-label !text-[9.5px]">{t.readyToInvoice}</div>
          <div className="text-[18px] font-bold tabular-nums mt-1.5">{toInvoice.count}</div>
          <div className="text-[11px] placeholder-text mt-0.5 truncate">{toInvoice.first ?? t.nothingWaiting}</div>
        </Link>
      </div>

      <div className="mt-5">
        <h3 className="heading-label !text-[10px] mb-2.5">{t.cashflowMonth(formatMonthKey(cashflow.month, locale))}</h3>
        <ul className="flex flex-col gap-2.5">
          {bars.map(([label, value, color]) => (
            <li key={label} className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-2.5 text-[12px]">
              <span className="placeholder-text truncate">{label}</span>
              <span className="h-2 rounded-full bg-ink/8 overflow-hidden">
                <span className="block h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: color }} />
              </span>
              <span className="tabular-nums font-semibold whitespace-nowrap">{formatCurrency(value)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/* --- Latest expenses ----------------------------------------------------------- */

export function ExpensesSection({
  expenses,
  locale,
  t,
  onViewProject,
}: {
  expenses: DashExpense[];
  locale: Locale;
  t: Dictionary;
  onViewProject: (project: DashProject) => void;
}) {
  const td = t.dashboard;
  const [openId, setOpenId] = useState<string | null>(null);
  const open = expenses.find((e) => e.id === openId) ?? null;
  const category = (c: string) => t.expenseCategories[c as keyof typeof t.expenseCategories] ?? c;
  const linked = (e: DashExpense) => (e.project ? e.project.title : td.companyOverheadShort);

  return (
    <Section label={td.latestExpenses} title={td.latestExpenses} sub={td.latestExpensesSub}>
      {expenses.length === 0 ? (
        <Empty>{td.noExpensesYet}</Empty>
      ) : (
        <div className={`grid grid-cols-1 gap-4 ${open ? "lg:grid-cols-[minmax(0,1fr)_300px]" : ""}`}>
          <ul className="flex flex-col min-w-0">
            {expenses.map((e) => (
              <li key={e.id} className="border-t border-ink/8 first:border-t-0">
                <button
                  type="button"
                  onClick={() => setOpenId(e.id)}
                  aria-pressed={openId === e.id}
                  className={`w-full text-left flex items-center gap-3 py-3 px-2 -mx-2 rounded-lg transition-colors hover:bg-ink/5 ${
                    openId === e.id ? "bg-ink/[0.07]" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] truncate">{e.note || category(e.category)}</span>
                    <span className="block text-[12px] placeholder-text truncate">{linked(e)}</span>
                  </span>
                  <span className="font-semibold tabular-nums whitespace-nowrap">{formatCurrency(e.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
          {open && (
            <aside aria-label={open.note || category(open.category)} className="rounded-xl border border-ink/12 bg-ink/[0.04] p-4 min-w-0 self-start">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[15px] font-semibold leading-snug min-w-0 break-words">{open.note || category(open.category)}</h3>
                <button type="button" onClick={() => setOpenId(null)} aria-label={td.closeDetail} className="btno !px-2 !py-1 text-[10px] shrink-0">
                  ✕
                </button>
              </div>
              <dl className="mt-3 flex flex-col gap-2.5 text-[12.5px]">
                {(
                  [
                    [td.expenseAmount, formatCurrency(open.amount)],
                    [td.expenseCategory, category(open.category)],
                    [td.expenseLinked, linked(open)],
                    [td.detailDates, formatPragueDate(open.date, locale, { day: "numeric", month: "long", year: "numeric" })],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <div key={k}>
                    <dt className="heading-label !text-[9.5px]">{k}</dt>
                    <dd className="mt-0.5 break-words">{v}</dd>
                  </div>
                ))}
              </dl>
              {open.project && (
                <button type="button" className="btn mt-4" onClick={() => onViewProject(open.project!)}>
                  {td.viewProject}
                </button>
              )}
            </aside>
          )}
        </div>
      )}
    </Section>
  );
}
