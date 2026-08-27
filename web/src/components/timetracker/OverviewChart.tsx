"use client";

import { useRef, useState } from "react";
import { formatMinutes } from "@/lib/format";
import { ChartAxisGrid } from "@/components/ui/ChartAxisGrid";

type ChartRow = { id: string; label: string; color: string; byBucket: number[] };
type ChartBucket = { label: string };

/**
 * Toggl's "Duration by day" hover: the hovered column's bars stay full
 * opacity while every other column dims, and a small card floats near the
 * top of the plot showing that bucket's total (plus a per-row breakdown).
 */
export function OverviewChart({
  buckets,
  rows,
  axisMax,
  axisTicks,
  totalLabel,
}: {
  buckets: ChartBucket[];
  rows: ChartRow[];
  axisMax: number;
  axisTicks: string[];
  totalLabel: string;
}) {
  const [hover, setHover] = useState<{ idx: number; left: number } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  function onEnter(e: React.MouseEvent<HTMLDivElement>, idx: number) {
    const chartRect = chartRef.current?.getBoundingClientRect();
    const colRect = e.currentTarget.getBoundingClientRect();
    if (!chartRect) return;
    setHover({ idx, left: colRect.left - chartRect.left + colRect.width / 2 });
  }

  const hoveredTotal = hover ? rows.reduce((s, r) => s + r.byBucket[hover.idx], 0) : 0;

  return (
    <div className="overflow-x-auto">
      <div ref={chartRef} className="relative h-56 mt-5" style={{ minWidth: 74 + buckets.length * 60 }}>
        <ChartAxisGrid ticks={axisTicks} />
        {hover && (
          <div
            className="card absolute z-10 top-0 px-3 py-2 text-[11px] pointer-events-none shadow-[0_10px_28px_rgba(0,0,0,0.4)] min-w-[140px]"
            style={{ left: hover.left, transform: "translateX(-50%)" }}
          >
            <div className="font-semibold whitespace-nowrap">{buckets[hover.idx].label}</div>
            <div className="flex items-center justify-between gap-4 mt-1 text-ink/80">
              <span>{totalLabel}</span>
              <span className="font-semibold tabular-nums">{formatMinutes(hoveredTotal)}</span>
            </div>
            {rows.length > 1 && (
              <div className="flex flex-col gap-0.5 mt-1.5 pt-1.5 border-t border-ink/10">
                {rows.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: r.color }} />
                      <span className="truncate">{r.label}</span>
                    </span>
                    <span className="tabular-nums placeholder-text">{formatMinutes(r.byBucket[hover.idx])}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="absolute left-[74px] right-1 top-0 bottom-0 flex items-end gap-2">
          {buckets.map((b, bi) => (
            <div
              key={bi}
              className="flex-1 flex items-end justify-center gap-1 min-w-0"
              style={{ height: 224 }}
              onMouseEnter={(e) => onEnter(e, bi)}
              onMouseLeave={() => setHover((h) => (h?.idx === bi ? null : h))}
            >
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="w-3 rounded-t transition-opacity"
                  style={{
                    height: `${(r.byBucket[bi] / axisMax) * 100}%`,
                    background: r.color,
                    opacity: hover == null || hover.idx === bi ? 1 : 0.3,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex ml-[74px] mr-1 justify-between mt-2.5" style={{ minWidth: buckets.length * 60 }}>
        {buckets.map((b, i) => (
          <span
            key={i}
            className={`text-[11.5px] flex-1 text-center transition-colors ${hover?.idx === i ? "text-ink font-semibold" : "placeholder-text"}`}
          >
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}
