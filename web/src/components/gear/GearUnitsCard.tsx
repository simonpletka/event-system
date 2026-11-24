"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { getDictionary, type Locale } from "@/lib/dictionary";
import { addGearUnitAction, deleteGearUnitAction } from "@/lib/actions/gear";
import type { GearConditionValue } from "@/lib/gear-reservations";
import { formatGearCode } from "@/lib/gear-code";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { Modal } from "@/components/ui/Modal";
import { ConditionChip } from "./ConditionChip";
import { ReportIssueButton } from "./ReportIssueButton";
import { UnitConditionEditor } from "./UnitConditionEditor";
import { formatDay, formatDayRange, PlusIcon } from "./shared";

export type UnitView = {
  id: string;
  number: number;
  code: string;
  condition: GearConditionValue;
  conditionNote: string | null;
  backAt: string | null;
  openIssues: number;
  hasHistory: boolean;
  reservedToday: boolean;
  overdue: boolean;
  days: ("free" | "booked" | "out")[];
  next: { startDate: string; endDate: string; project: string | null; note: string } | null;
};

const STRIP: Record<UnitView["days"][number], string> = {
  free: "bg-ink/9",
  booked: "bg-accent/60",
  // Out of use: hatched, so it reads differently from a booking.
  out: "bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--color-warning)_45%,transparent)_0_4px,transparent_4px_8px)]",
};

/**
 * Each unit with its condition, code, a 14-day strip (booked, or out of use)
 * and its next booking. Sits inside the type's <form>, so it holds only plain
 * buttons; the condition editor and the report form open in popups, which
 * render outside the form.
 */
export function GearUnitsCard({
  typeId,
  typeName,
  units,
  days,
  today,
  canManage,
  locale,
}: {
  typeId: string;
  typeName: string;
  units: UnitView[];
  days: string[];
  today: string;
  canManage: boolean;
  locale: Locale;
}) {
  const dict = getDictionary(locale);
  const t = dict.gear;
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<UnitView | null>(null);
  const [showRetired, setShowRetired] = useState(false);
  const retired = units.filter((u) => u.condition === "RETIRED");
  const shown = showRetired ? units : units.filter((u) => u.condition !== "RETIRED");

  return (
    <section aria-label={t.unitsNext14} className="card p-5 md:p-6 flex flex-col">
      <div className="flex justify-between items-center gap-3 mb-2">
        <h2 className="text-[20px] font-bold">{t.unitsNext14}</h2>
        {canManage && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const fd = new FormData();
              fd.set("typeId", typeId);
              startTransition(() => addGearUnitAction(fd));
            }}
            className="btno inline-flex items-center gap-2"
          >
            <PlusIcon /> {t.addUnit}
          </button>
        )}
      </div>
      {units.length === 0 && <p className="text-[13px] placeholder-text py-3">{t.noUnits}</p>}
      <ul aria-busy={pending}>
        {shown.map((u) => {
          const nextText = u.next
            ? t.next(
                u.next.startDate <= today ? `${t.now} – ${formatDayRange(u.next.endDate, u.next.endDate, locale)}` : formatDayRange(u.next.startDate, u.next.endDate, locale),
                u.next.project ?? (u.next.note || t.noProject)
              )
            : t.nextNone;
          return (
            <li key={u.id} className={`grid grid-cols-[56px_minmax(0,1fr)] gap-3.5 items-start py-4 border-t border-ink/10 ${u.condition === "RETIRED" ? "opacity-60" : ""}`}>
              <span className="flex flex-col">
                <span className="text-[16px] font-bold">{t.unitNumber(u.number)}</span>
                <Link href={`/g/${u.code}`} title={t.openUnitPage} className="text-[10px] placeholder-text tabular-nums hover:text-accent">
                  {formatGearCode(u.code)}
                </Link>
              </span>
              <div className="flex flex-col gap-2.5 min-w-0">
                <div className="flex flex-wrap gap-2 items-center justify-between">
                  <span className="text-[13.5px] placeholder-text">{u.condition === "RETIRED" ? t.retired : nextText}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {u.overdue && <span className="tag tag-warning">{t.overdue}</span>}
                    {u.openIssues > 0 && <span className="tag tag-attention">{t.openIssuesCount(u.openIssues)}</span>}
                    {u.condition === "OK" ? (
                      <span className={`tag ${u.reservedToday ? "tag-attention" : "tag-positive"}`}>{u.reservedToday ? t.reservedToday : t.available}</span>
                    ) : (
                      <ConditionChip condition={u.condition} backAt={u.backAt} locale={locale} />
                    )}
                  </span>
                </div>
                {u.conditionNote && u.condition !== "OK" && <p className="text-[12.5px] placeholder-text -mt-1">{u.conditionNote}</p>}
                <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-[3px]" aria-hidden>
                  {u.days.map((state, i) => (
                    <span
                      key={days[i]}
                      title={formatDay(days[i], locale, { weekday: "short", day: "numeric", month: "short" })}
                      className={`h-[26px] rounded-[5px] ${STRIP[state]} ${days[i] === today ? "ring-1 ring-ink/40" : ""}`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <ReportIssueButton
                    locale={locale}
                    unit={{ id: u.id, label: `${typeName} #${u.number}` }}
                    canManage={canManage}
                    className="text-[12px] font-semibold text-accent hover:underline"
                  />
                  {canManage && (
                    <button type="button" onClick={() => setEditing(u)} className="text-[12px] placeholder-text hover:text-ink">
                      {t.changeCondition}
                    </button>
                  )}
                  {canManage && !u.hasHistory && (
                    <ConfirmDeleteButton
                      action={deleteGearUnitAction}
                      fields={{ id: u.id }}
                      confirmMessage={t.deleteUnitConfirm(u.number)}
                      label={t.deleteUnit}
                      pendingLabel={dict.common.deleting}
                      className="text-[12px] text-warning hover:underline"
                    />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {retired.length > 0 && (
        <button type="button" onClick={() => setShowRetired((v) => !v)} className="self-start mt-2 text-[12px] placeholder-text hover:text-ink">
          {showRetired ? "−" : "+"} {t.condition.RETIRED} ({retired.length})
        </button>
      )}
      {editing && (
        <Modal title={`${t.changeCondition}: ${typeName} #${editing.number}`} onClose={() => setEditing(null)} closeLabel={dict.common.close}>
          <UnitConditionEditor unitId={editing.id} condition={editing.condition} note={editing.conditionNote} backAt={editing.backAt} locale={locale} compact />
        </Modal>
      )}
    </section>
  );
}
