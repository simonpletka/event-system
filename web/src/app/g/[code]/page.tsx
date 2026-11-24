import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { requireUser, canManageGear, canHandleGearPickup } from "@/lib/authz";
import { getLocale, getDictionary } from "@/lib/i18n";
import { normalizeGearCode, formatGearCode } from "@/lib/gear-code";
import { getGearUnitPage } from "@/lib/queries/gear-ops";
import { formatPragueDate } from "@/lib/prague-date";
import { formatCurrency } from "@/lib/format";
import { deleteGearIssueAction } from "@/lib/actions/gear-units";
import { ConditionChip } from "@/components/gear/ConditionChip";
import { PickupChecklist } from "@/components/gear/PickupChecklist";
import { ReportIssueButton } from "@/components/gear/ReportIssueButton";
import { UnitConditionEditor } from "@/components/gear/UnitConditionEditor";
import { ReassignButton } from "@/components/gear/ReassignButton";
import { IssueEditor } from "@/components/gear/IssueEditor";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { formatDayRange } from "@/components/gear/shared";

/**
 * The unit page a scanned QR code or NFC tag opens: what it is, its
 * condition, its booking now or next, and big Pick up / Return / Report
 * buttons. The desk-side view of the type stays at /gear/[typeId].
 */
export default async function GearScanPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = normalizeGearCode(decodeURIComponent(raw));
  // Signed out: log in, then come straight back here.
  if (!(await auth())?.user) redirect(`/login?next=${encodeURIComponent(`/g/${code ?? raw}`)}`);
  const user = await requireUser();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.gear;
  if (code && code !== raw) redirect(`/g/${code}`);

  const page = code ? await getGearUnitPage(user, code) : null;
  if (!page) {
    return (
      <div className="pt-10 flex flex-col gap-4">
        <Link href="/gear" className="text-[13px] placeholder-text hover:text-accent">
          ← {t.backToGear}
        </Link>
        <h1 className="text-[28px] font-bold">{t.unitNotFound}</h1>
        <p className="text-[14px] placeholder-text">{formatGearCode((code ?? raw).toUpperCase().padEnd(8, "·").slice(0, 8))}</p>
      </div>
    );
  }

  const canManage = canManageGear(user);
  const { unit } = page;
  const label = `${unit.typeName} #${unit.number}`;
  const unitOption = { id: unit.id, label };
  const when = (iso: string) => formatPragueDate(iso, locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const current = page.current;
  const canHandleCurrent = current ? canHandleGearPickup(user, current.projectAccess) : false;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/gear/${unit.typeId}`} className="text-[13px] placeholder-text hover:text-accent py-2">
          ← {unit.category} · {unit.typeName}
        </Link>
        <span className="text-[12px] placeholder-text tabular-nums tracking-[0.08em]">{formatGearCode(unit.code)}</span>
      </div>

      <header className="flex flex-col gap-2">
        <h1 className="text-[32px] leading-tight font-bold tracking-tight">{label}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ConditionChip condition={unit.condition} backAt={unit.backAt} locale={locale} />
          {page.issues.filter((i) => i.status === "OPEN" || i.status === "IN_SERVICE").length > 0 && (
            <span className="tag tag-attention">{t.openIssuesCount(page.issues.filter((i) => i.status === "OPEN" || i.status === "IN_SERVICE").length)}</span>
          )}
        </div>
        {unit.conditionNote && <p className="text-[14px] placeholder-text">{unit.conditionNote}</p>}
      </header>

      <section aria-label={t.currentBooking} className="card p-5">
        <h2 className="heading-label mb-1">{t.currentBooking}</h2>
        {current ? (
          <PickupChecklist rows={[current]} canHandle={canHandleCurrent} canManage={canManage} locale={locale} showDates big />
        ) : (
          <p className="text-[14px] placeholder-text py-2">{t.noBookings}</p>
        )}
        <div className="mt-3">
          <ReportIssueButton
            locale={locale}
            unit={unitOption}
            projectId={current?.project?.id ?? null}
            reservationId={current?.id ?? null}
            canManage={canManage}
            className="btno w-full min-h-[52px] !text-[12px]"
          />
        </div>
      </section>

      {page.affected.length > 0 && (
        <section aria-label={t.affectedTitle} className="card p-5 border-warning/50">
          <h2 className="heading-label mb-2 !text-warning">{t.affectedTitle}</h2>
          <ul>
            {page.affected.map((r) => (
              <li key={r.id} className="flex flex-col gap-1.5 py-2.5 border-t border-ink/10 first:border-t-0">
                <span className="text-[14px]">
                  {formatDayRange(r.startDate, r.endDate, locale)} · {r.project ? `${r.project.number} ${r.project.title}` : r.note || t.noProject}
                </span>
                {canManage && <ReassignButton reservationId={r.id} locale={locale} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      {page.upcoming.length > 0 && (
        <section aria-label={t.nextBookings} className="card p-5">
          <h2 className="heading-label mb-1">{t.nextBookings}</h2>
          <PickupChecklist
            rows={page.upcoming}
            canHandle={page.upcoming.every((r) => canHandleGearPickup(user, r.projectAccess))}
            canManage={canManage}
            locale={locale}
            showDates
          />
        </section>
      )}

      {canManage && (
        <section aria-label={t.changeCondition} className="card p-5">
          <h2 className="heading-label mb-2">{t.changeCondition}</h2>
          <UnitConditionEditor unitId={unit.id} condition={unit.condition} note={unit.conditionNote} backAt={unit.backAt} locale={locale} compact />
        </section>
      )}

      <section aria-label={t.issuesTitle} className="card p-5">
        <h2 className="heading-label mb-2">{t.issuesTitle}</h2>
        {page.issues.length === 0 && <p className="text-[14px] placeholder-text">{t.noIssuesForUnit}</p>}
        <ul>
          {page.issues.map((i) => (
            <li key={i.id} className="flex flex-col gap-2 py-3 border-t border-ink/10 first:border-t-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`tag ${i.severity === "UNUSABLE" ? "tag-warning" : i.severity === "MAJOR" ? "tag-attention" : "tag-neutral"}`}>{t.severity[i.severity]}</span>
                <span className={`tag ${i.status === "RESOLVED" ? "tag-positive" : i.status === "WONT_FIX" ? "tag-neutral" : "tag-attention"}`}>{t.issueStatus[i.status]}</span>
                <span className="text-[12px] placeholder-text">
                  {t.reportedBy(i.reportedBy ?? "?", when(i.reportedAt))}
                  {i.project ? ` · ${t.onProject(`${i.project.number} ${i.project.title}`)}` : ""}
                </span>
              </div>
              <p className="text-[14.5px] whitespace-pre-wrap">{i.description}</p>
              {i.photos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {i.photos.map((p) => (
                    <a key={p.id} href={`/api/uploads/gear-issue-photos/${p.id}`} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- authenticated route, not a static asset */}
                      <img src={`/api/uploads/gear-issue-photos/${p.id}`} alt={p.originalName} className="w-24 h-24 object-cover rounded-xl border border-ink/10" />
                    </a>
                  ))}
                </div>
              )}
              {i.resolutionNote && <p className="text-[13px] placeholder-text">{i.resolutionNote}</p>}
              {canManage && i.repairCost != null && <p className="text-[13px] placeholder-text">{t.repairCost}: {formatCurrency(i.repairCost)}</p>}
              {canManage && (
                <div className="flex flex-col gap-2">
                  <IssueEditor issue={{ id: i.id, status: i.status, resolutionNote: i.resolutionNote, repairCost: i.repairCost }} locale={locale} />
                  <ConfirmDeleteButton
                    action={deleteGearIssueAction}
                    fields={{ id: i.id }}
                    confirmMessage={t.deleteIssueConfirm}
                    label={t.deleteIssue}
                    pendingLabel={dict.common.deleting}
                    className="self-start text-[12px] text-warning hover:underline"
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label={t.history} className="card p-5">
        <h2 className="heading-label mb-2">{t.history}</h2>
        {page.events.length === 0 && <p className="text-[14px] placeholder-text">{t.noHistory}</p>}
        <ol>
          {page.events.map((e) => (
            <li key={e.id} className="flex justify-between gap-3 py-2 border-t border-ink/8 first:border-t-0 text-[13px]">
              <span>
                <span className="font-semibold">{t.event[e.type] ?? e.type}</span>
                {e.type === "CONDITION_CHANGED" && typeof e.data.to === "string" ? ` · ${t.condition[e.data.to] ?? e.data.to}` : ""}
                {e.type === "REASSIGNED" ? ` · #${String(e.data.fromUnit)} → #${String(e.data.toUnit)}` : ""}
                {e.type === "RETURNED" && e.data.notPickedUp ? ` · ${t.eventReturnedNotPicked}` : ""}
                {e.type === "REPORTED" && typeof e.data.severity === "string" ? ` · ${t.severity[e.data.severity]}` : ""}
              </span>
              <span className="placeholder-text text-right shrink-0">
                {e.actor ? `${e.actor} · ` : ""}
                {when(e.at)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <p className="text-[12px] placeholder-text text-center">{t.scanHint}</p>
    </div>
  );
}
