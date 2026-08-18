"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";

export type SegmentedTabOption = { value: string; label: string; href: string };

/**
 * Glass pill segmented control with a sliding highlight behind the active
 * option — replaces the hand-rolled bordered-box switches each page used to
 * build on its own (List/Timeline/Calendar, Table/Calendar, Day/Week/Month).
 * The thumb tracks the active button's real measured width/position rather
 * than assuming equal-width options, since labels vary in length here.
 */
export function SegmentedTabs({ options, active }: { options: SegmentedTabOption[]; active: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef(new Map<string, HTMLAnchorElement>());
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const el = buttonRefs.current.get(active);
    if (!container || !el) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    setThumb({ left: elRect.left - containerRect.left, width: elRect.width });
  }, [active, options]);

  return (
    <div
      ref={containerRef}
      className="relative inline-flex p-1 rounded-full border border-ink/16 bg-ink/5 backdrop-blur-xl"
    >
      {thumb && (
        <div
          className="absolute top-1 bottom-1 rounded-full bg-ink/[0.16] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_10px_rgba(0,0,0,0.3)] transition-[left,width] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          style={{ left: thumb.left, width: thumb.width }}
        />
      )}
      {options.map((opt) => {
        const isActive = opt.value === active;
        return (
          <Link
            key={opt.value}
            href={opt.href}
            ref={(el) => {
              if (el) buttonRefs.current.set(opt.value, el);
              else buttonRefs.current.delete(opt.value);
            }}
            className={`relative z-[1] px-5 py-2 text-[11px] font-semibold tracking-[0.1em] uppercase text-center transition-colors ${
              isActive ? "text-ink" : "text-ink/55 hover:text-ink/80"
            }`}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
