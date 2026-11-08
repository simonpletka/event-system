import Link from "next/link";

export type ChipLink = { key: string; label: string; href: string };

/** Filter or view chips as links: the selected one is solid orange with white text, with no animation. */
export function ChipLinks({ chips, active, label }: { chips: ChipLink[]; active: string; label?: string }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1.5">
      {chips.map((chip) => {
        const selected = chip.key === active;
        return (
          <Link
            key={chip.key}
            href={chip.href}
            scroll={false}
            aria-current={selected ? "true" : undefined}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-semibold tracking-[0.1em] uppercase border focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              selected ? "bg-accent border-accent text-white" : "border-ink/20 text-ink/55 hover:text-ink"
            }`}
          >
            {chip.label}
          </Link>
        );
      })}
    </nav>
  );
}
