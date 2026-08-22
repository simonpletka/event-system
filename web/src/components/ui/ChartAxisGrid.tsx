/** Horizontal gridlines + axis labels for a bar chart, top (max) to bottom (0). Sits absolutely inside a `relative` chart container. */
export function ChartAxisGrid({ ticks }: { ticks: string[] }) {
  return (
    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
      {ticks.map((label, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <span className="w-16 shrink-0 text-right text-[10.5px] tabular-nums text-ink/40">{label}</span>
          <div className={`flex-1 h-px ${i === ticks.length - 1 ? "bg-ink/18" : "bg-ink/8"}`} />
        </div>
      ))}
    </div>
  );
}
