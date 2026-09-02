import Link from "next/link";
import type { ReactNode } from "react";
import type { ProjectStatus } from "@/generated/prisma/enums";
import type { Dictionary } from "@/lib/i18n";
import { ProjectStatusPill } from "@/components/StatusPill";
import { ChartAxisGrid } from "@/components/ui/ChartAxisGrid";
import { projectHref } from "@/lib/slug";
import {
  formatCurrency,
  formatDate,
  formatDateRange,
  formatMinutes,
  formatDurationShort,
  niceMinutesAxis,
  type CurrencyCode,
} from "@/lib/format";

/* ----------------------------------------------------------------------------
 * Shared building blocks for the four role dashboards. All server components —
 * the interactivity lives in SegmentedTabs / WeekCalendar, which the shell
 * mounts separately.
 * ------------------------------------------------------------------------- */

export function SectionHeading({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="mb-3">
      <div className="heading-label !text-[12px] font-bold">{label}</div>
      {sub && <div className="text-[12.5px] placeholder-text mt-1">{sub}</div>}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="text-[13px] placeholder-text">{children}</p>;
}

/* --- stat tiles ---------------------------------------------------------- */

export function StatRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">{children}</div>;
}

export function StatTile({
  label,
  value,
  sub,
  warn,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
  /** When set the whole tile is a link to the matching filtered list. */
  href?: string;
}) {
  const inner = (
    <>
      {warn && <div className="absolute top-0 inset-x-0 h-0.5 bg-warning" />}
      <div className="heading-label !text-[10px]">{label}</div>
      <div className={`text-[26px] font-bold tracking-tight tabular-nums mt-3 ${warn ? "text-warning" : ""}`}>{value}</div>
      {sub && <div className="text-[11.5px] placeholder-text mt-1.5">{sub}</div>}
    </>
  );
  const cls = `card relative overflow-hidden px-5 py-[18px] ${warn ? "border-warning/35" : ""}`;
  if (href) {
    return (
      <Link href={href} className={`${cls} block transition-colors hover:border-ink/35`}>
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}

/* --- project cards ------------------------------------------------------------ */

export type DashProjectCard = {
  id: string;
  number: string;
  title: string;
  company: string;
  status: ProjectStatus;
  start: Date;
  end: Date;
  venue: string | null;
  nextTitle: string | null;
  budget?: { amount: number | null; spent: number };
};

export function ProjectCardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">{children}</div>;
}

export function ProjectCard({ ev, t }: { ev: DashProjectCard; t: Dictionary }) {
  const td = t.dashboard;
  return (
    <Link
      href={projectHref(ev)}
      className="card block overflow-hidden hover:border-ink/35 transition-colors"
    >
      <div className="p-4 flex flex-col gap-2.5">
        <ProjectStatusPill status={ev.status} t={t.statusProject} />
        <div className="text-[15px] font-semibold leading-snug">{ev.title}</div>
        <div className="text-[12px] placeholder-text leading-relaxed">
          {ev.company}
          <br />
          {formatDateRange(ev.start, ev.end)}
          {ev.venue ? ` · ${ev.venue}` : ""}
        </div>
        {ev.budget &&
          (ev.budget.amount === null ? (
            <div className="text-[10.5px] placeholder-text mt-0.5">{td.noBudgetSet}</div>
          ) : (
            <BudgetBar amount={ev.budget.amount} spent={ev.budget.spent} label={td.budgetUsed} />
          ))}
      </div>
      <div className="h-px bg-ink/10" />
      <div className="flex justify-between items-center px-4 py-2.5 text-[11px]">
        <span className="heading-label">{td.nextMilestone}</span>
        <span className="text-ink/75">{ev.nextTitle ?? "—"}</span>
      </div>
    </Link>
  );
}

function BudgetBar({
  amount,
  spent,
  label,
}: {
  amount: number;
  spent: number;
  label: (pct: number, budget: string) => string;
}) {
  const ratio = amount > 0 ? spent / amount : 0;
  const pct = Math.round(ratio * 100);
  const tone = ratio > 1 ? "bg-warning" : ratio >= 0.85 ? "bg-attention" : "bg-positive";
  return (
    <div className="flex flex-col gap-1.5 mt-0.5">
      <div className="h-[5px] rounded-full bg-ink/10 overflow-hidden">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="text-[10.5px] placeholder-text tabular-nums">{label(pct, formatCurrency(amount))}</div>
    </div>
  );
}

/* --- generic row list ----------------------------------------------------- */

export function RowCard({ children }: { children: ReactNode }) {
  return <div className="card px-[18px] py-1.5">{children}</div>;
}

export function Row({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3.5 py-3 border-t border-ink/8 first:border-t-0 text-[13px]">{children}</div>
  );
}

/* --- expenses ----------------------------------------------------------- */

export function ExpenseList({
  expenses,
  t,
  showPayer,
}: {
  expenses: {
    id: string;
    category: string;
    amount: number;
    project: { id: string; title: string } | null;
    paidBy?: { name: string | null } | null;
  }[];
  t: Dictionary;
  showPayer?: boolean;
}) {
  const td = t.dashboard;
  if (expenses.length === 0) return <EmptyState>{td.noExpensesYet}</EmptyState>;
  return (
    <RowCard>
      {expenses.map((exp) => (
        <Row key={exp.id}>
          <span className="flex-1 min-w-0 truncate">
            {t.expenseCategories[exp.category as keyof typeof t.expenseCategories] ?? exp.category}{" "}
            <span className="placeholder-text">
              · {exp.project ? exp.project.title : td.companyOverheadShort}
            </span>
          </span>
          {showPayer && (
            <span className="placeholder-text text-[11.5px] whitespace-nowrap hidden sm:inline">
              {exp.paidBy?.name ?? td.paidByCard}
            </span>
          )}
          <span className="font-semibold tabular-nums whitespace-nowrap">{formatCurrency(exp.amount)}</span>
        </Row>
      ))}
    </RowCard>
  );
}

/* --- cashflow ----------------------------------------------------------- */

export function CashflowPanel({
  cashflow,
  t,
}: {
  cashflow: { monthStart: Date; invoiced: number; paid: number; outstanding: number; expenses: number };
  t: Dictionary;
}) {
  const td = t.dashboard;
  const denom = Math.max(cashflow.invoiced, cashflow.paid + cashflow.outstanding, 1);
  const paidPct = (cashflow.paid / denom) * 100;
  const outPct = (cashflow.outstanding / denom) * 100;
  return (
    <div>
      <SectionHeading
        label={td.cashflowMonth(formatDate(cashflow.monthStart, { month: "long" }))}
        sub={td.cashflowSubtitle}
      />
      <div className="card p-5 flex flex-col gap-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <CashNum k={td.invoiced} v={formatCurrency(cashflow.invoiced)} />
          <CashNum k={td.paid} v={formatCurrency(cashflow.paid)} tone="text-positive" />
          <CashNum k={td.outstanding} v={formatCurrency(cashflow.outstanding)} tone="text-attention" />
          <CashNum k={td.expensesLabel} v={formatCurrency(cashflow.expenses)} />
        </div>
        <div className="h-2 rounded-full bg-ink/8 overflow-hidden flex">
          <span className="h-full bg-positive" style={{ width: `${paidPct}%` }} />
          <span className="h-full bg-attention" style={{ width: `${outPct}%` }} />
        </div>
      </div>
    </div>
  );
}

function CashNum({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div>
      <div className="heading-label !text-[9.5px]">{k}</div>
      <div className={`text-[18px] font-bold tabular-nums mt-1.5 ${tone ?? ""}`}>{v}</div>
    </div>
  );
}

/* --- tracked-time chart (ported from the old dashboard) ------------------ */

export function TrackedTimeChart({
  buckets,
  byBucket,
  total,
  t,
}: {
  buckets: { label: string; start: Date; end: Date }[];
  byBucket: number[];
  total: number;
  t: Dictionary;
}) {
  const td = t.dashboard;
  const nowMs = new Date().getTime();

  // Axis fits the week's actual max, but every tick stays a whole or half
  // hour (niceMinutesAxis steps in multiples of 30m) — never an odd fraction.
  const { axisMax, ticks: tickValues } = niceMinutesAxis(Math.max(0, ...byBucket));
  const ticks = tickValues.map(formatDurationShort);

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
        <div>
          <div className="heading-label !text-[12px] font-bold">{td.myTrackedTime}</div>
          <div className="text-[12.5px] placeholder-text mt-1">{td.thisWeek}</div>
        </div>
        {total > 0 && <div className="text-[15px] font-semibold tabular-nums">{formatMinutes(total)}</div>}
      </div>

      {total === 0 ? (
        <div className="card px-5 py-6">
          <EmptyState>
            {td.notEnoughData}{" "}
            <Link href="/time-tracker/tracking" className="text-accent hover:underline">
              {td.startATimer}
            </Link>
          </EmptyState>
        </div>
      ) : (
        <div className="card px-5 py-5">
          <div className="relative h-52">
            <ChartAxisGrid ticks={ticks} />
            <div className="absolute left-[74px] right-1 inset-y-0 flex items-end justify-between gap-1">
              {buckets.map((b, i) => {
                const minutes = byBucket[i] ?? 0;
                const isToday = b.start.getTime() <= nowMs && nowMs < b.end.getTime();
                return (
                  <div key={b.label} className="flex flex-col items-center justify-end flex-1 h-full">
                    {minutes > 0 && (
                      <span className="text-[10.5px] font-semibold tabular-nums text-ink whitespace-nowrap mb-1">
                        {formatMinutes(minutes)}
                      </span>
                    )}
                    <div
                      className="w-4 rounded-t"
                      style={{
                        height: `${(minutes / axisMax) * 100}%`,
                        background: isToday
                          ? "color-mix(in srgb, var(--color-ink) 82%, transparent)"
                          : "color-mix(in srgb, var(--color-ink) 34%, transparent)",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex ml-[74px] mr-1 justify-between mt-2.5">
            {buckets.map((b) => {
              const isToday = b.start.getTime() <= nowMs && nowMs < b.end.getTime();
              return (
                <span
                  key={b.label}
                  className={`text-[11.5px] flex-1 text-center ${isToday ? "font-semibold text-ink" : "placeholder-text"}`}
                >
                  {b.label}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* --- currency helper re-export for callers ----------------------------- */
export function money(amount: number, currency?: CurrencyCode) {
  return formatCurrency(amount, currency);
}
