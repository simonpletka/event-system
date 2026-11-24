import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import { projectHref } from "@/lib/slug";
import { getDictionary, type Locale } from "@/lib/dictionary";
import { releaseGearBatchAction } from "@/lib/actions/gear";
import type { GearBatch } from "@/lib/queries/gear";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { formatDayRange } from "./shared";
import { EditBatchButton } from "./EditBatchButton";
import type { GearTypeOption } from "@/lib/queries/gear";
import type { PickableProject } from "@/components/ProjectPicker";

/** One click's worth of reservations: dates, who/what for, units per type, estimate and Release. */
export function GearBatchCard({
  batch,
  showProject,
  canRelease,
  edit,
  locale,
}: {
  batch: GearBatch;
  /** On the Reservations tab: name the project (or the note when there is none). */
  showProject: boolean;
  canRelease: boolean;
  /** What the Edit popup needs; leave out to hide Edit. */
  edit?: { types: GearTypeOption[]; projects: PickableProject[]; today: string };
  locale: Locale;
}) {
  const t = getDictionary(locale).gear;
  const title = batch.groupName ?? t.individualGear;
  return (
    <section aria-label={title} className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {showProject && (
            <div className="text-[12px] mb-0.5">
              {batch.project ? (
                <Link href={projectHref(batch.project, "/gear")} className="font-semibold hover:text-accent">
                  {batch.project.number} {batch.project.title}
                </Link>
              ) : (
                <span className="tag tag-neutral">{t.noProject}</span>
              )}
            </div>
          )}
          <h2 className="text-[17px] font-bold">{title}</h2>
          <p className="text-[13px] placeholder-text mt-0.5">
            {formatDayRange(batch.startDate, batch.endDate, locale)} · {t.totalLine(batch.count, batch.count, batch.days)}
            {batch.createdBy ? ` · ${t.reservedBy(batch.createdBy)}` : ""}
          </p>
          {batch.note && <p className="text-[13px] mt-1">{batch.note}</p>}
        </div>
        <div className="flex gap-1.5">
        {edit && <EditBatchButton batch={batch} types={edit.types} projects={edit.projects} today={edit.today} locale={locale} />}
        {canRelease && (
          <ConfirmDeleteButton
            action={releaseGearBatchAction}
            fields={{ batchId: batch.batchId }}
            confirmMessage={t.releaseConfirm(batch.count)}
            label={t.release}
            pendingLabel={t.releasing}
          />
        )}
        </div>
      </div>
      <ul className="mt-3">
        {batch.lines.map((l) => (
          <li key={l.typeId} className="flex justify-between gap-3 py-2.5 border-t border-ink/10 text-[14px]">
            <span className="min-w-0">
              <Link href={`/gear/${l.typeId}`} className="font-semibold hover:text-accent">
                {l.numbers.length}× {l.name}
              </Link>
              <span className="placeholder-text"> · {l.numbers.map((n) => `#${n}`).join(", ")}</span>
            </span>
            <span className="placeholder-text tabular-nums whitespace-nowrap">{t.perDay(formatCurrency(l.dayRate * l.numbers.length))}</span>
          </li>
        ))}
      </ul>
      <div className="flex justify-between pt-3 border-t border-ink/10 text-[13px]">
        <span className="placeholder-text">{t.estimate}</span>
        <span className="font-bold tabular-nums">{formatCurrency(batch.cost)}</span>
      </div>
    </section>
  );
}
