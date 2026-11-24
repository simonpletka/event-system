"use client";

import { useTransition } from "react";
import { getDictionary, type Locale } from "@/lib/dictionary";
import { addGearUnitAction, deleteGearUnitAction, setGearUnitActiveAction } from "@/lib/actions/gear";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { formatDay, formatDayRange, PlusIcon } from "./shared";

export type UnitView = {
  id: string;
  number: number;
  active: boolean;
  hasReservations: boolean;
  reservedToday: boolean;
  days: boolean[];
  next: { startDate: string; endDate: string; project: string | null; note: string } | null;
};

/** Each unit with a 14-day strip and its next booking. Plain buttons only: it sits inside the type's form. */
export function GearUnitsCard({
  typeId,
  units,
  days,
  today,
  canManage,
  locale,
}: {
  typeId: string;
  units: UnitView[];
  days: string[];
  today: string;
  canManage: boolean;
  locale: Locale;
}) {
  const dict = getDictionary(locale);
  const t = dict.gear;
  const [pending, startTransition] = useTransition();

  function run(action: (fd: FormData) => Promise<void>, fields: Record<string, string>) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    startTransition(() => action(fd));
  }

  return (
    <section aria-label={t.unitsNext14} className="card p-5 md:p-6 flex flex-col">
      <div className="flex justify-between items-center gap-3 mb-2">
        <h2 className="text-[20px] font-bold">{t.unitsNext14}</h2>
        {canManage && (
          <button type="button" disabled={pending} onClick={() => run(addGearUnitAction, { typeId })} className="btno inline-flex items-center gap-2">
            <PlusIcon /> {t.addUnit}
          </button>
        )}
      </div>
      {units.length === 0 && <p className="text-[13px] placeholder-text py-3">{t.noUnits}</p>}
      <ul aria-busy={pending}>
        {units.map((u) => {
          const nextText = u.next
            ? t.next(u.next.startDate <= today ? `${t.now} – ${formatDayRange(u.next.endDate, u.next.endDate, locale)}` : formatDayRange(u.next.startDate, u.next.endDate, locale), u.next.project ?? (u.next.note || t.noProject))
            : t.nextNone;
          return (
            <li key={u.id} className={`grid grid-cols-[56px_minmax(0,1fr)] gap-3.5 items-center py-4 border-t border-ink/10 ${u.active ? "" : "opacity-60"}`}>
              <span className="text-[16px] font-bold">{t.unitNumber(u.number)}</span>
              <div className="flex flex-col gap-2.5 min-w-0">
                <div className="flex flex-wrap gap-2.5 items-center justify-between">
                  <span className="text-[13.5px] placeholder-text">{u.active ? nextText : t.retired}</span>
                  <span className="flex items-center gap-2">
                    {u.active && <span className={`tag ${u.reservedToday ? "tag-attention" : "tag-positive"}`}>{u.reservedToday ? t.reservedToday : t.available}</span>}
                    {canManage &&
                      (u.active ? (
                        <ConfirmDeleteButton
                          action={setGearUnitActiveAction}
                          fields={{ id: u.id, active: "false" }}
                          confirmMessage={t.retireConfirm(u.number)}
                          label={t.retire}
                          pendingLabel={dict.common.saving}
                          className="text-[12px] placeholder-text hover:text-ink px-1"
                        />
                      ) : (
                        <button type="button" disabled={pending} onClick={() => run(setGearUnitActiveAction, { id: u.id, active: "true" })} className="text-[12px] placeholder-text hover:text-ink px-1">
                          {t.reactivate}
                        </button>
                      ))}
                    {canManage &&
                      (u.hasReservations ? null : (
                        <ConfirmDeleteButton
                          action={deleteGearUnitAction}
                          fields={{ id: u.id }}
                          confirmMessage={t.deleteUnitConfirm(u.number)}
                          label={t.deleteUnit}
                          pendingLabel={dict.common.deleting}
                          className="text-[12px] text-warning hover:underline px-1"
                        />
                      ))}
                  </span>
                </div>
                <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-[3px]" aria-hidden>
                  {u.days.map((busy, i) => (
                    <span
                      key={days[i]}
                      title={formatDay(days[i], locale, { weekday: "short", day: "numeric", month: "short" })}
                      className={`h-[26px] rounded-[5px] ${busy ? "bg-accent/60" : "bg-ink/9"} ${days[i] === today ? "ring-1 ring-ink/40" : ""}`}
                    />
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
