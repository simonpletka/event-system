"use client";

import { useRef, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { ChartAxisGrid } from "@/components/ui/ChartAxisGrid";

export type MonthDatum = { label: string; income: number; expense: number };

/**
 * Income-vs-expenses monthly bars for Finance → Reports. Hover a month to
 * dim the others and float a card with that month's Income / Expenses /
 * Balance — same interaction as the time-tracker OverviewChart.
 */
export function MonthlyBarChart({
  months,
  axisMax,
  axisTicks,
  incomeColor,
  labels,
}: {
  months: MonthDatum[];
  axisMax: number;
  axisTicks: string[];
  incomeColor: string;
  labels: { income: string; expenses: string; balance: string };
}) {
  const [hover, setHover] = useState<{ idx: number; left: number } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  function onEnter(e: React.MouseEvent<HTMLDivElement>, idx: number) {
    const chartRect = chartRef.current?.getBoundingClientRect();
    const colRect = e.currentTarget.getBoundingClientRect();
    if (!chartRect) return;
    setHover({ idx, left: colRect.left - chartRect.left + colRect.width / 2 });
  }

  const hm = hover ? months[hover.idx] : null;

  return (
    <div className="overflow-x-auto">
      <div ref={chartRef} className="relative h-[200px] mt-2 min-w-[500px]">
        <ChartAxisGrid ticks={axisTicks} />
        {hm && (
          <div
            className="card absolute z-10 top-0 px-3 py-2 text-[11px] pointer-events-none shadow-[0_10px_28px_rgba(0,0,0,0.4)] min-w-[150px]"
            style={{ left: hover!.left, transform: "translateX(-50%)" }}
          >
            <div className="font-semibold whitespace-nowrap">{hm.label}</div>
            <div className="flex flex-col gap-0.5 mt-1 text-ink/80">
              <Line k={labels.income} v={formatCurrency(hm.income)} dot={incomeColor} />
              <Line k={labels.expenses} v={formatCurrency(hm.expense)} dotClass="bg-accent" />
              <div className="flex items-center justify-between gap-4 mt-1 pt-1 border-t border-ink/10">
                <span>{labels.balance}</span>
                <span className="font-semibold tabular-nums">{formatCurrency(hm.income - hm.expense)}</span>
              </div>
            </div>
          </div>
        )}
        <div className="absolute left-[74px] right-1 top-0 bottom-0 flex items-end justify-between gap-[3px]">
          {months.map((m, i) => (
            <div
              key={i}
              className="flex items-end justify-center gap-[2px] flex-1"
              style={{ height: 200 }}
              onMouseEnter={(e) => onEnter(e, i)}
              onMouseLeave={() => setHover((h) => (h?.idx === i ? null : h))}
            >
              <div
                className="w-2 rounded-t transition-opacity"
                style={{
                  height: `${(m.income / axisMax) * 100}%`,
                  background: incomeColor,
                  opacity: hover == null || hover.idx === i ? 1 : 0.3,
                }}
              />
              <div
                className="w-2 rounded-t bg-accent transition-opacity"
                style={{
                  height: `${(m.expense / axisMax) * 100}%`,
                  opacity: hover == null || hover.idx === i ? 1 : 0.3,
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex ml-[74px] mr-1 justify-between mt-2 min-w-[426px]">
        {months.map((m, i) => (
          <span
            key={i}
            className={`label flex-1 text-center transition-colors ${hover?.idx === i ? "!text-ink font-semibold" : ""}`}
          >
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Line({ k, v, dot, dotClass }: { k: string; v: string; dot?: string; dotClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-sm shrink-0 ${dotClass ?? ""}`} style={dot ? { background: dot } : undefined} />
        {k}
      </span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
}
