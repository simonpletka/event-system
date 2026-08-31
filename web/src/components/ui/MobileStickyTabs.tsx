import type { ReactNode } from "react";

/**
 * Slim frosted tab bar pinned to the top of the viewport on phones only.
 *
 * `PageHeader` is `md:sticky` — on phones the full section header scrolls
 * away with the page so it stops eating half the viewport. Sections whose
 * tab strip still needs to stay reachable (Finance, Time tracker, an event's
 * Overview/Roadmap/… tabs, Settings) render this right after their
 * `PageHeader`: it carries a second copy of the same tabs, `md:hidden`, so
 * only one is ever visible per breakpoint.
 *
 * Full-bleed (`-mx-6 px-6`) with `overflow-x-auto` so a long tab set scrolls
 * horizontally instead of clipping. No sidebar exists at this width, so the
 * frost can sit directly on the element rather than in a viewport-spanning
 * layer the way `PageHeader` needs.
 */
export function MobileStickyTabs({ children }: { children: ReactNode }) {
  return (
    <div className="md:hidden sticky top-0 z-20 -mx-6 mb-1 px-6 py-2 overflow-x-auto backdrop-blur-2xl bg-gradient-to-b from-bg/90 to-bg/70 border-b border-ink/10">
      {children}
    </div>
  );
}
