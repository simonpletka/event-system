"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCurrency } from "@/lib/format";

export type ByProjectRow = { id: string; title: string; href: string; income: number; expense: number };

const TOP = 5;
// Phones drop the expenses column so the row still fits without scrolling.
const GRID = "grid gap-2 grid-cols-[minmax(0,1fr)_auto_auto] md:grid-cols-[minmax(0,1fr)_.8fr_.8fr_.8fr]";

/** Projects ranked by invoiced amount: the top five, expandable to all, with the total always visible. */
export function ByProjectCard({
  rows,
  expandedByDefault,
  labels,
}: {
  rows: ByProjectRow[];
  /** The print view shows every project. */
  expandedByDefault?: boolean;
  labels: { project: string; income: string; expenses: string; balance: string; total: string; showAll: string; showTop: string };
}) {
  const [expanded, setExpanded] = useState(Boolean(expandedByDefault));
  const sorted = [...rows].sort((a, b) => b.income - a.income);
  const visible = expanded ? sorted : sorted.slice(0, TOP);
  const income = rows.reduce((s, r) => s + r.income, 0);
  const expense = rows.reduce((s, r) => s + r.expense, 0);

  return (
    <div>
      <div className={`${GRID} border-b-2 border-ink pb-1.5`}>
        <span className="heading-label !text-[9px] font-bold">{labels.project}</span>
        <span className="heading-label !text-[9px] font-bold text-right">{labels.income}</span>
        <span className="heading-label !text-[9px] font-bold text-right hidden md:block">{labels.expenses}</span>
        <span className="heading-label !text-[9px] font-bold text-right">{labels.balance}</span>
      </div>
      {visible.map((p) => (
        <Link key={p.id} href={p.href} className={`${GRID} items-center py-2.5 border-b border-ink/12 text-[14px] hover:bg-ink/5`}>
          <span className="truncate">{p.title}</span>
          <span className="text-right tabular-nums whitespace-nowrap placeholder-text">{formatCurrency(p.income)}</span>
          <span className="text-right tabular-nums whitespace-nowrap placeholder-text hidden md:block">{formatCurrency(p.expense)}</span>
          <span className="text-right tabular-nums whitespace-nowrap">{formatCurrency(p.income - p.expense)}</span>
        </Link>
      ))}
      <div className={`${GRID} items-center py-2.5 text-[14px] font-semibold`}>
        <span>{labels.total}</span>
        <span className="text-right tabular-nums whitespace-nowrap">{formatCurrency(income)}</span>
        <span className="text-right tabular-nums whitespace-nowrap hidden md:block">{formatCurrency(expense)}</span>
        <span className="text-right tabular-nums whitespace-nowrap">{formatCurrency(income - expense)}</span>
      </div>
      {sorted.length > TOP && (
        <button type="button" className="btno mt-2 print-hide" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
          {expanded ? labels.showTop : labels.showAll}
        </button>
      )}
    </div>
  );
}
