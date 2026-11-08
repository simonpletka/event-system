"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { projectHref } from "@/lib/slug";
import { getDictionary, type Locale } from "@/lib/dictionary";

/**
 * Project detail tabs. Each tab is a route, but this component lives in the
 * project layout, so it stays mounted while tabs change: the orange highlight
 * keeps its previous position and slides to the new tab. Links don't scroll
 * to the top, so switching tabs keeps your place on the page.
 */
export function ProjectTabs({
  project,
  showFinance,
  locale,
}: {
  project: { number: string; title: string };
  showFinance: boolean;
  locale: Locale;
}) {
  const t = getDictionary(locale).projects;
  const pathname = usePathname();
  const base = projectHref(project);
  const tabs = [
    { value: "overview", href: base, label: t.tabOverview },
    { value: "roadmap", href: `${base}/roadmap`, label: t.tabRoadmap },
    ...(showFinance ? [{ value: "finance", href: `${base}/finance`, label: t.tabFinance }] : []),
    { value: "trips", href: `${base}/trips`, label: t.tabTrips },
    { value: "files", href: `${base}/files`, label: t.tabFiles },
  ];
  const seg = pathname.slice(base.length).split("/")[1] || "overview";
  const active = tabs.some((x) => x.value === seg) ? seg : "overview";

  // Follow a click straight away rather than waiting for the route to commit.
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
