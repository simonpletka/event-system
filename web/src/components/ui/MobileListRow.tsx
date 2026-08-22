import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Stacked-card row for list pages at phone width, replacing a desktop
 * multi-column CSS-grid row (5-8 uneven columns don't survive a 375px
 * viewport). Desktop rows stay untouched (`hidden md:grid`); this renders
 * as the `md:hidden` sibling, fed the same already-fetched row data.
 */
export function MobileListRow({
  href,
  subLeft,
  title,
  tag,
  meta,
  trailing,
  chevron = true,
}: {
  href: string;
  subLeft?: string;
  title: ReactNode;
  tag?: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-2.5 py-3.5 px-3.5 min-h-[44px] rounded-2xl border-b border-ink/8 last:border-b-0 hover:bg-ink/5"
    >
      <div className="flex-1 min-w-0">
        {subLeft && <div className="placeholder-text text-[10.5px] mb-0.5">{subLeft}</div>}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[14px] font-semibold truncate group-hover:text-accent">{title}</span>
          {tag}
        </div>
        {meta && <div className="placeholder-text text-[11.5px] mt-0.5 group-hover:!text-accent">{meta}</div>}
      </div>
      {trailing && <div className="text-right shrink-0 text-[13px] font-semibold">{trailing}</div>}
      {chevron && (
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-ink/30"
        >
          <path d="M9 5l7 7-7 7" />
        </svg>
      )}
    </Link>
  );
}
