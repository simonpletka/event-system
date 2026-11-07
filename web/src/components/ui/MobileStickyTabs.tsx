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
 * horizontally instead of clipping. The bar itself is transparent, so the
 * pill floats over the page like the bottom tab bar. That leaves the pill as
 * the only thing between its labels and the content scrolling behind it, so
 * it gets a tinted backing here (blur alone leaves sharp text readable).
 */
export function MobileStickyTabs({ children }: { children: ReactNode }) {
  return (
    <div className="md:hidden sticky top-0 z-20 -mx-6 mb-1 px-6 py-2 overflow-x-auto [&>*]:w-max [&>*]:!bg-bg/72">
      {children}
    </div>
  );
}
