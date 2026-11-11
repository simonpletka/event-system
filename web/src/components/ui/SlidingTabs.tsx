"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";

export type SlidingTab = { value: string; href: string; label: React.ReactNode };

/**
 * Route tabs with one orange highlight that slides to the selected tab. It
 * must live in a layout so it stays mounted while tabs change; that's what
 * lets the highlight start from its previous position. Links keep the scroll
 * position, and the highlight follows a click before the route commits.
 */
export function SlidingTabs({ tabs, active }: { tabs: SlidingTab[]; active: string }) {
  const [shown, setShown] = useState(active);
  const [prevActive, setPrevActive] = useState(active);
  if (active !== prevActive) {
    setPrevActive(active);
    setShown(active);
  }

  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<string, HTMLAnchorElement>());
  const [ind, setInd] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const el = tabRefs.current.get(shown);
    if (!container || !el) return;
    const measure = () => {
      const c = container.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      // clientLeft: the bar's border, since the highlight is positioned inside it.
      setInd({ left: r.left - c.left - container.clientLeft + container.scrollLeft, width: r.width });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [shown, tabs.length]);

  return (
    <div className="max-w-full overflow-x-auto">
      <div ref={containerRef} role="tablist" className="relative inline-flex p-1 rounded-full border border-ink/16 bg-ink/5">
        {ind && (
          <span
            data-testid="tab-indicator"
            aria-hidden
            className="absolute top-1 bottom-1 rounded-full bg-accent shadow-[0_4px_14px_color-mix(in_srgb,var(--color-accent)_28%,transparent)] transition-[left,width] duration-[380ms] ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
            style={{ left: ind.left, width: ind.width }}
          />
        )}
        {tabs.map((tab) => {
          const selected = tab.value === shown;
          return (
            <Link
              key={tab.value}
              href={tab.href}
              scroll={false}
              role="tab"
              aria-selected={selected}
              onClick={() => setShown(tab.value)}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.value, el);
                else tabRefs.current.delete(tab.value);
              }}
              className={`relative z-[1] shrink-0 px-5 py-2 rounded-full text-[11px] font-semibold tracking-[0.1em] uppercase whitespace-nowrap transition-colors duration-300 motion-reduce:transition-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                selected ? "text-white" : "text-ink/55 hover:text-ink"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
