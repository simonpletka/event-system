"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  "/events": (
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

export function MobileNav({ tNav }: { tNav: Dictionary["nav"] }) {
  const pathname = usePathname();

  const NAV = [
    { href: "/dashboard", label: tNav.dashboard },
    { href: "/clients", label: tNav.clients },
    { href: "/events", label: tNav.events },
    { href: "/finance", label: tNav.finance },
    { href: "/time-tracker", label: tNav.timeTracker },
  ];

  return (
    <div
      className="md:hidden fixed left-3 right-3 bottom-3 z-30 glass-panel rounded-full shadow-[0_14px_36px_rgba(0,0,0,0.45)] flex items-center px-3 py-[9px] print-hide"
      style={{ paddingBottom: "calc(9px + env(safe-area-inset-bottom))" }}
    >
      {NAV.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} className="flex-1 flex justify-center">
            <span
              className="flex flex-col items-center gap-1 rounded-full px-3.5 pt-1.5 pb-[5px]"
              style={
                active
                  ? {
                      background:
                        "linear-gradient(155deg, color-mix(in srgb, var(--color-ink) 26%, transparent), color-mix(in srgb, var(--color-ink) 7%, transparent) 60%), color-mix(in srgb, var(--color-accent) 16%, transparent)",
                      backdropFilter: "blur(5px)",
                      WebkitBackdropFilter: "blur(5px)",
                      border: "1px solid color-mix(in srgb, var(--color-ink) 28%, transparent)",
                      boxShadow:
                        "inset 0 1px 1.5px color-mix(in srgb, var(--color-ink) 50%, transparent), inset 0 -4px 6px color-mix(in srgb, var(--color-accent) 16%, transparent), 0 3px 10px color-mix(in srgb, var(--color-accent) 20%, transparent)",
                      color: "var(--color-accent)",
                    }
                  : { color: "color-mix(in srgb, var(--color-ink) 55%, transparent)" }
              }
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
