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
  titleHref,
  subLeft,
  title,
  tag,
  meta,
  trailing,
  chevron = true,
}: {
  href: string;
  /**
   * When set, the title text becomes its own link to this destination while the
   * rest of the row still navigates to `href`. Implemented with a stretched
   * overlay link, since an <a> can't legally nest inside another <a>.
   */
  titleHref?: string;
  subLeft?: string;
  title: ReactNode;
  tag?: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
}) {
  const chevronIcon = chevron ? (
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
  ) : null;

  const rowClass =
    "group relative flex items-center gap-2.5 py-3.5 px-3.5 min-h-[44px] rounded-2xl border-b border-ink/8 last:border-b-0 hover:bg-ink/5";

  const body = (
    <>
      <div className="flex-1 min-w-0">
        {subLeft && <div className="placeholder-text text-[10.5px] mb-0.5">{subLeft}</div>}
        <div className="flex items-center gap-1.5 flex-wrap">
          {titleHref ? (
            <Link href={titleHref} className="relative z-[1] text-[14px] font-semibold truncate hover:text-accent">
              {title}
            </Link>
          ) : (
            <span className="text-[14px] font-semibold truncate group-hover:text-accent">{title}</span>
          )}
          {tag}
        </div>
        {meta && <div className="placeholder-text text-[11.5px] mt-0.5 group-hover:!text-accent">{meta}</div>}
      </div>
      {trailing && <div className="relative z-[1] text-right shrink-0 text-[13px] font-semibold">{trailing}</div>}
      {chevronIcon}
    </>
  );

  // With a separate title link the whole row can't be one <a>; navigate the rest
  // of the card via a stretched overlay link instead.
  if (titleHref) {
    return (
      <div className={rowClass}>
        <Link href={href} aria-hidden tabIndex={-1} className="absolute inset-0 z-0" />
        {body}
      </div>
    );
  }

  return (
    <Link href={href} className={rowClass}>
      {body}
    </Link>
  );
}
