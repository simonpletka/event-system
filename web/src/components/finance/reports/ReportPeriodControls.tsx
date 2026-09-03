"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { stepAnchor, type ReportPeriod } from "@/lib/finance-period";
import { isoDate } from "@/lib/calendar";

type Labels = {
  month: string;
  quarter: string;
  year: string;
  custom: string;
  from: string;
  to: string;
  apply: string;
  thisPeriod: string;
};

export type ReportQuery = {
  period: ReportPeriod;
  anchor: string;
  from: string;
  to: string;
  tab: string;
};

function href(q: ReportQuery, patch: Partial<ReportQuery>) {
  const next = { ...q, ...patch };
  const sp = new URLSearchParams();
  sp.set("tab", next.tab);
  sp.set("period", next.period);
  if (next.period === "custom") {
    if (next.from) sp.set("from", next.from);
    if (next.to) sp.set("to", next.to);
  } else {
    sp.set("anchor", next.anchor);
  }
  return `/finance/reports?${sp.toString()}`;
}

export function ReportPeriodControls({
  query,
  rangeLabel,
  labels,
}: {
  query: ReportQuery;
  rangeLabel: string;
  labels: Labels;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(query.from);
  const [to, setTo] = useState(query.to);

  const periodOptions = (["month", "quarter", "year", "custom"] as const).map((p) => ({
    value: p,
    label: labels[p],
    href: href(query, { period: p }),
  }));

  return (
    <div className="flex flex-wrap items-center gap-2 print-hide">
      <SegmentedTabs options={periodOptions} active={query.period} />

      {query.period === "custom" ? (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(href(query, { period: "custom", from, to }));
          }}
        >
          <label className="flex items-center gap-1 text-[11px]">
            <span className="heading-label">{labels.from}</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input py-1 px-2 text-[12px]" />
          </label>
          <label className="flex items-center gap-1 text-[11px]">
            <span className="heading-label">{labels.to}</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input py-1 px-2 text-[12px]" />
          </label>
          <button type="submit" className="btno px-3 py-1.5">
            {labels.apply}
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-1.5">
          <Link href={href(query, { anchor: stepAnchor(query.period, query.anchor, -1) })} className="btno px-2 py-1.5">
            ←
          </Link>
          <span className="text-[11px] tracking-[0.08em] uppercase min-w-[120px] text-center tabular-nums">{rangeLabel}</span>
          <Link href={href(query, { anchor: stepAnchor(query.period, query.anchor, 1) })} className="btno px-2 py-1.5">
            →
          </Link>
          <Link href={href(query, { anchor: isoDate(new Date()) })} className="btno px-3 py-1.5 text-[10px]">
            {labels.thisPeriod}
          </Link>
        </div>
      )}
    </div>
  );
}
