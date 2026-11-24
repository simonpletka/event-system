"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/dictionary";
import { pickUpGearAction, returnGearAction, undoGearPickupAction, undoGearReturnAction, type PickupResult } from "@/lib/actions/gear-units";
import type { GearReservationRow } from "@/lib/queries/gear-ops";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { Modal } from "@/components/ui/Modal";
import { formatPragueDate } from "@/lib/prague-date";
import { ConditionChip } from "./ConditionChip";
import { ReassignButton } from "./ReassignButton";
import { ReportIssueForm } from "./ReportIssueForm";
import { formatDayRange } from "./shared";

/**
 * A reservation as a list of units to tick off: picked up, returned. Ticking
 * by hand is the manual way; a scan later ticks the same row. "Pick up all"
 * and "Return all" cover the usual case. Return asks whether everything is
 * OK, and "Report a problem" files a report that also marks it returned.
 */
export function PickupChecklist({
  rows,
  canHandle,
  canManage,
  locale,
  showDates = false,
  big = false,
}: {
  rows: GearReservationRow[];
  /** May pick up and return these (manager, or can edit the project). */
  canHandle: boolean;
  canManage: boolean;
  locale: Locale;
  showDates?: boolean;
  /** Phone-first sizing for the unit page. */
  big?: boolean;
}) {
  const dict = getDictionary(locale);
  const t = dict.gear;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [messages, setMessages] = useState<string[]>([]);
  const [asking, setAsking] = useState<string[] | null>(null);
  const [problem, setProblem] = useState<GearReservationRow | null>(null);

  const when = (iso: string) => formatPragueDate(iso, locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  function run(action: (ids: string[]) => Promise<PickupResult>, ids: string[]) {
    startTransition(async () => {
      const result = await action(ids);
      setMessages([...new Set(result.blocked.map((b) => t.blocked[b.reason]))]);
      setAsking(null);
      router.refresh();
    });
  }

  const toPick = rows.filter((r) => !r.pickedUpAt && !r.returnedAt && r.pickupOpen && r.unitUsable).map((r) => r.id);
  const toReturn = rows.filter((r) => !r.returnedAt && (r.pickedUpAt || r.overdue)).map((r) => r.id);
  const btn = big ? "min-h-[52px] px-5 text-[12px]" : "min-h-[38px]";

  return (
    <div className="flex flex-col gap-3">
      {canHandle && rows.length > 1 && (toPick.length > 0 || toReturn.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {toPick.length > 0 && (
            <button type="button" disabled={pending} onClick={() => run(pickUpGearAction, toPick)} className={`btn ${btn}`}>
              {pending ? t.pickingUp : `${t.pickUpAll} (${toPick.length})`}
            </button>
          )}
          {toReturn.length > 0 && (
            <button type="button" disabled={pending} onClick={() => setAsking(toReturn)} className={`btno ${btn}`}>
              {`${t.returnAll} (${toReturn.length})`}
            </button>
          )}
        </div>
      )}

      <ul>
        {rows.map((r) => {
          const out = r.pickedUpAt && !r.returnedAt;
          return (
            <li key={r.id} className={`flex flex-col gap-2 border-t border-ink/10 ${big ? "py-4" : "py-3"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 flex flex-wrap items-center gap-2">
                  <Link href={`/g/${r.unit.code}`} className={`${big ? "text-[16px]" : "text-[14px]"} font-semibold hover:text-accent`}>
                    {r.unit.typeName} #{r.unit.number}
                  </Link>
                  {r.unit.condition !== "OK" && <ConditionChip condition={r.unit.condition} backAt={r.unit.backAt} locale={locale} />}
                  {r.overdue && <span className="tag tag-warning">{t.overdue}</span>}
                </span>
                {canHandle && (
                  <span className="flex flex-wrap gap-1.5">
                    {!r.pickedUpAt && !r.returnedAt && r.pickupOpen && r.unitUsable && (
                      <button type="button" disabled={pending} onClick={() => run(pickUpGearAction, [r.id])} className={`btn ${btn}`}>
                        {t.pickUp}
                      </button>
                    )}
                    {!r.returnedAt && (out || r.overdue) && (
                      <button type="button" disabled={pending} onClick={() => setAsking([r.id])} className={`btno ${btn}`}>
                        {t.returnUnit}
                      </button>
                    )}
                  </span>
                )}
              </div>
              <div className="text-[12.5px] placeholder-text flex flex-col gap-0.5">
                {showDates && (
                  <span>
                    {formatDayRange(r.startDate, r.endDate, locale)} · {r.project ? `${r.project.number} ${r.project.title}` : r.note || t.noProject}
                  </span>
                )}
                {r.pickedUpAt ? <span>{t.pickedUpBy(r.pickedUpBy ?? "?", when(r.pickedUpAt))}</span> : <span>{t.notPickedUp}</span>}
                {r.returnedAt && <span className="text-positive">{t.returnedBy(r.returnedBy ?? "?", when(r.returnedAt))}</span>}
                {r.overdue && <span className="text-warning">{t.overdueSince(formatDayRange(r.endDate, r.endDate, locale))}</span>}
                {!r.pickedUpAt && !r.returnedAt && r.pickupOpen && !r.unitUsable && <span className="text-warning">{t.blocked.unusable}</span>}
                {!r.pickedUpAt && !r.returnedAt && r.pickupOpen && r.unitUsable && r.unit.condition === "NEEDS_ATTENTION" && (
                  <span className="text-attention">{t.attentionWarning}</span>
                )}
              </div>
              {canManage && !r.pickedUpAt && !r.returnedAt && !r.unitUsable && <ReassignButton reservationId={r.id} locale={locale} />}
              {canManage && (r.pickedUpAt || r.returnedAt) && (
                <span className="flex flex-wrap gap-3">
                  {r.returnedAt ? (
                    <ConfirmDeleteButton
                      action={undoGearReturnAction}
                      fields={{ id: r.id }}
                      confirmMessage={t.undoReturnConfirm}
                      label={t.undoReturn}
                      pendingLabel={dict.common.saving}
                      className="text-[12px] placeholder-text hover:text-ink"
                    />
                  ) : (
                    <ConfirmDeleteButton
                      action={undoGearPickupAction}
                      fields={{ id: r.id }}
                      confirmMessage={t.undoPickupConfirm}
                      label={t.undoPickup}
                      pendingLabel={dict.common.saving}
                      className="text-[12px] placeholder-text hover:text-ink"
                    />
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {messages.map((m) => (
        <p key={m} role="alert" className="text-[13px] text-warning">
          {m}
        </p>
      ))}

      {asking && (
        <Modal title={t.everythingOk} onClose={() => setAsking(null)} closeLabel={dict.common.close}>
          <div className="flex flex-col gap-2.5">
            <button type="button" disabled={pending} onClick={() => run(returnGearAction, asking)} className="btn min-h-[52px] font-semibold">
              {pending ? t.returning : t.returnOk}
            </button>
            {asking.length === 1 && (
              <button
                type="button"
                onClick={() => {
                  setProblem(rows.find((r) => r.id === asking[0]) ?? null);
                  setAsking(null);
                }}
                className="btno min-h-[52px] !border-warning text-warning"
              >
                {t.returnProblem}
              </button>
            )}
          </div>
        </Modal>
      )}

      {problem && (
        <Modal title={t.reportTitle} onClose={() => setProblem(null)} closeLabel={dict.common.close}>
          <ReportIssueForm
            locale={locale}
            unit={{ id: problem.unit.id, label: `${problem.unit.typeName} #${problem.unit.number}` }}
            projectId={problem.project?.id ?? null}
            reservationId={problem.id}
            markReturned
            canManage={canManage}
            onDone={() => setProblem(null)}
          />
        </Modal>
      )}
    </div>
  );
}
