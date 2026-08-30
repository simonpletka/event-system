import type { ReactNode } from "react";

/**
 * The app-wide sticky page header bar: a frosted, gradient-tinted strip
 * pinned to the top of the scroll area with a hairline underline.
 *
 * It must be a **direct child of the page's `<main>` padding box** so the
 * content lines up with the page body. The frosted background itself is a
 * separate absolutely-positioned layer that spans the **full viewport width**
 * (`left-[calc(100%-100vw)] w-screen`) — so the strip continues left behind
 * the floating sidebar (which sits above it at `z-30`). Put the page's
 * `max-w-*` on a wrapper *inside* here (and on the body) so the header
 * content aligns with the content under it. See `DashboardShell` /
 * `settings/page.tsx` for the pattern.
 *
 * `pb` is a separate prop rather than something you pass through `className`
 * because two `pb-*` utilities in one class list don't resolve by source
 * order (Tailwind cascade-layer gotcha, see CLAUDE.md).
 */
export function PageHeader({
  children,
  className = "",
  pb = "pb-4",
}: {
  children: ReactNode;
  className?: string;
  pb?: string;
}) {
  return (
    <div
      className={`sticky top-0 z-20 -mx-6 mt-0 md:-mt-5 px-6 pt-5 ${pb} ${className}`}
    >
      <div
        aria-hidden
        className="absolute inset-y-0 left-[calc(100%_-_100vw)] w-screen z-[-1] backdrop-blur-2xl bg-gradient-to-b from-bg/80 to-bg/50 border-b border-ink/10"
      />
      {children}
    </div>
  );
}
