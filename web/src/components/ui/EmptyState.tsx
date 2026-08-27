import Link from "next/link";

/**
 * The one place a "nothing here yet" message lives. Keeps the copy quiet and
 * the vertical rhythm consistent across lists, and lets a caller attach the
 * single action that resolves the emptiness (create the first thing).
 */
export function EmptyState({
  message,
  actionLabel,
  actionHref,
  compact,
}: {
  message: string;
  actionLabel?: string;
  actionHref?: string;
  /** Tighter padding — for empties inside a card or narrow column. */
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center gap-3 text-center ${compact ? "py-8" : "py-16"} px-6`}>
      <p className="text-sm placeholder-text max-w-sm leading-relaxed">{message}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="btno text-[9px]">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
