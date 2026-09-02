"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { Dictionary } from "@/lib/dictionary";

const ICONS: Record<string, React.ReactNode> = {
  "/dashboard": (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </>
  ),
  "/clients": (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20c0-3.5 3-5.6 6.5-5.6s6.5 2.1 6.5 5.6" />
      <path d="M15.5 8.3a3 3 0 1 1 3.6 2.9" />
      <path d="M21.5 20c0-2.6-1.7-4.5-4-5.3" />
    </>
  ),
  "/projects": (
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="2.2" />
      <path d="M8 2.5v4M16 2.5v4M3 9.5h18" />
    </>
  ),
  "/finance": (
    <>
      <rect x="2.5" y="6" width="19" height="13" rx="2" />
      <path d="M16 12.3h3.2" />
      <path d="M2.5 9.5h19" />
    </>
  ),
  "/time-tracker": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.2 2" />
    </>
  ),
};

// The active-tab pill. Was applied inline on whichever <span> was active;
// now it's a single element that slides between tab positions.
const PILL_STYLE: CSSProperties = {
  background:
    "linear-gradient(155deg, color-mix(in srgb, var(--color-ink) 26%, transparent), color-mix(in srgb, var(--color-ink) 7%, transparent) 60%), color-mix(in srgb, var(--color-accent) 16%, transparent)",
  backdropFilter: "blur(5px)",
  WebkitBackdropFilter: "blur(5px)",
  border: "1px solid color-mix(in srgb, var(--color-ink) 28%, transparent)",
  boxShadow:
    "inset 0 1px 1.5px color-mix(in srgb, var(--color-ink) 50%, transparent), inset 0 -4px 6px color-mix(in srgb, var(--color-accent) 16%, transparent), 0 3px 10px color-mix(in srgb, var(--color-accent) 20%, transparent)",
};

const ACTIVE_COLOR = "var(--color-accent)";
const IDLE_COLOR = "color-mix(in srgb, var(--color-ink) 55%, transparent)";

export function MobileNav({ tNav }: { tNav: Dictionary["nav"] }) {
  const pathname = usePathname();

  const NAV = [
    { href: "/dashboard", label: tNav.dashboard },
    { href: "/clients", label: tNav.clients },
    { href: "/projects", label: tNav.projects },
    { href: "/finance", label: tNav.finance },
    { href: "/time-tracker", label: tNav.timeTracker },
  ];

  const activeHref = NAV.find((item) => pathname.startsWith(item.href))?.href ?? null;

  const containerRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef(new Map<string, HTMLSpanElement>());
  const [thumb, setThumb] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  // Optimistic selection: move the pill on click straight away, then let the
  // real `activeHref` (driven by pathname) reconcile once navigation lands —
  // same pattern as SegmentedTabs.
  const [shown, setShown] = useState<string | null>(activeHref);
  const [prevActive, setPrevActive] = useState(activeHref);
  if (activeHref !== prevActive) {
    setPrevActive(activeHref);
    setShown(activeHref);
  }

  useLayoutEffect(() => {
    const container = containerRef.current;
    const el = shown ? pillRefs.current.get(shown) : null;
    // No matching tab (e.g. /settings): keep the last pill position and let
    // opacity fade it out rather than snapping it away.
    if (!container || !el) return;
    const measure = () => {
      const c = container.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      setThumb({ left: r.left - c.left, top: r.top - c.top, width: r.width, height: r.height });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [shown]);

  return (
    <div
      ref={containerRef}
      className="md:hidden fixed left-3 right-3 bottom-3 z-30 glass-panel rounded-full shadow-[0_14px_36px_rgba(0,0,0,0.45)] flex items-center px-3 py-[9px] print-hide"
      style={{ paddingBottom: "calc(9px + env(safe-area-inset-bottom))" }}
    >
      {thumb && (
        <div
          aria-hidden
          className="absolute rounded-full transition-[left,top,width,height,opacity] duration-[380ms] ease-[cubic-bezier(0.34,1.3,0.64,1)] motion-reduce:transition-none"
          style={{
            ...PILL_STYLE,
            left: thumb.left,
            top: thumb.top,
            width: thumb.width,
            height: thumb.height,
            opacity: shown ? 1 : 0,
          }}
        />
      )}
      {NAV.map((item) => {
        const active = item.href === shown;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setShown(item.href)}
            className="relative z-[1] flex-1 flex justify-center"
          >
            <span
              ref={(el) => {
                if (el) pillRefs.current.set(item.href, el);
                else pillRefs.current.delete(item.href);
              }}
              className="flex flex-col items-center gap-1 rounded-full px-3.5 pt-1.5 pb-[5px] transition-colors duration-300 motion-reduce:transition-none"
              style={{ color: active ? ACTIVE_COLOR : IDLE_COLOR }}
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {ICONS[item.href]}
              </svg>
              <span
                className={`text-[9px] tracking-[0.04em] whitespace-nowrap ${active ? "font-semibold" : "font-medium"}`}
              >
                {item.label}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
