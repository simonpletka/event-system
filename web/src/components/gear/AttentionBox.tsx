import Link from "next/link";
import { getDictionary, type Locale } from "@/lib/dictionary";
import type { GearReservationRow } from "@/lib/queries/gear-ops";
import { ReassignButton } from "./ReassignButton";
import { formatDayRange } from "./shared";

/**
 * The Catalog's "Needs attention" box: bookings on units that can't serve
 * them (with Reassign for gear managers) and units not returned on time.
 * Shown only when there's something in it.
 */
export function AttentionBox({
  affected,
  overdue,
  canManage,
  locale,
}: {
  affected: GearReservationRow[];
  overdue: GearReservationRow[];
  canManage: boolean;
  locale: Locale;
}) {
  if (affected.length === 0 && overdue.length === 0) return null;
  const t = getDictionary(locale).gear;
  const what = (r: GearReservationRow) => (r.project ? `${r.project.number} ${r.project.title}` : r.note || t.noProject);
  return (
    <section aria-label={t.attentionTitle} className="card p-4 md:p-5 border-warning/40">
      <h2 className="heading-label !text-warning mb-2">{t.attentionTitle}</h2>
      <ul>
        {affected.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 border-t border-ink/8 first:border-t-0">
            <Link href={`/g/${r.unit.code}`} className="text-[13.5px] hover:text-accent min-w-0">
              {t.attentionAffected(`${r.unit.typeName} #${r.unit.number}`, t.condition[r.unit.condition], formatDayRange(r.startDate, r.endDate, locale), what(r))}
            </Link>
            {canManage && <ReassignButton reservationId={r.id} locale={locale} />}
          </li>
        ))}
        {overdue.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 border-t border-ink/8 first:border-t-0">
            <Link href={`/g/${r.unit.code}`} className="text-[13.5px] hover:text-accent min-w-0">
              <span className="tag tag-warning mr-2">{t.overdue}</span>
              {t.attentionOverdue(`${r.unit.typeName} #${r.unit.number}`, formatDayRange(r.startDate, r.endDate, locale), what(r))}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
