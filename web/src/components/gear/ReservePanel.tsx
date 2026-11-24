"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { formatCurrency } from "@/lib/format";
import { getDictionary, type Locale } from "@/lib/dictionary";
import { previewGearReservationAction, reserveGearAction, updateGearBatchAction, type PreviewResult } from "@/lib/actions/gear";
import { ProjectPicker, type PickableProject } from "@/components/ProjectPicker";
import type { GearTypeOption } from "@/lib/queries/gear";
import { CheckIcon, formatDayRange, WarningIcon } from "./shared";
import { gearError } from "./CategoryManager";

type Line = { typeId: string; quantity: number };

/**
 * Picks a project and whole days, previews which units each line would take
 * (the same plan the commit re-runs inside its transaction), then reserves.
 * When some lines are short it offers "Reserve N of M items" and never
 * reserves less than the person agreed to.
 */
export function ReservePanel({
  title,
  locale,
  projects,
  initialProjectId,
  types,
  initialLines,
  editableLines,
  groupId = null,
  today,
  canReserve,
  editBatch,
  onSaved,
}: {
  title: string;
  locale: Locale;
  projects: PickableProject[];
  initialProjectId?: string;
  /** Every type, for adding lines when `editableLines`. */
  types: GearTypeOption[];
  initialLines: Line[];
  editableLines: boolean;
  groupId?: string | null;
  /** Today's Prague date key, from the server. */
  today: string;
  canReserve: boolean;
  /** Edit an existing reservation instead of making a new one. */
  editBatch?: { batchId: string; projectId: string | null; note: string; startDate: string; endDate: string };
  /** Called after an edit is saved (the popup closes). */
  onSaved?: () => void;
}) {
  const dict = getDictionary(locale);
  const t = dict.gear;
  const [projectId, setProjectId] = useState(editBatch ? (editBatch.projectId ?? "") : (initialProjectId ?? ""));
  const [note, setNote] = useState(editBatch?.note ?? "");
  const [start, setStart] = useState(editBatch?.startDate ?? today);
  const [end, setEnd] = useState(editBatch?.endDate ?? today);
  const [lines, setLines] = useState<Line[]>(initialLines);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ count: number; projectTitle: string | null; href: string } | null>(null);
  const [reserving, startReserving] = useTransition();
  const [refreshKey, setRefreshKey] = useState(0);
  const requestId = useRef(0);

  // A changed group (another one selected) starts over from its items.
  const linesKey = JSON.stringify(initialLines);
  const [prevLinesKey, setPrevLinesKey] = useState(linesKey);
  if (linesKey !== prevLinesKey) {
    setPrevLinesKey(linesKey);
    setLines(initialLines);
    setDone(null);
    setError(null);
  }

  const activeLines = lines.filter((l) => l.quantity > 0);
  const query = JSON.stringify({ activeLines, start, end, refreshKey });
  useEffect(() => {
    const id = ++requestId.current;
    const timer = window.setTimeout(async () => {
      if (activeLines.length === 0) {
        if (id === requestId.current) setPreview(null);
        return;
      }
      setChecking(true);
      try {
        const result = await previewGearReservationAction({ lines: activeLines, startDate: start, endDate: end <= start ? start : end, excludeBatchId: editBatch?.batchId });
        if (id === requestId.current) setPreview(result);
      } finally {
        if (id === requestId.current) setChecking(false);
      }
    }, 200);
    return () => window.clearTimeout(timer);
    // `query` stands for activeLines/start/end/refreshKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const typeName = new Map(types.map((x) => [x.id, x.name]));
  const plan = preview?.ok ? preview : null;
  const range = formatDayRange(start, end < start ? start : end, locale);

  function setQuantity(typeId: string, quantity: number) {
    setDone(null);
    setLines((prev) => prev.map((l) => (l.typeId === typeId ? { ...l, quantity: Math.max(0, Math.min(100, quantity)) } : l)).filter((l) => l.quantity > 0));
  }

  function addLine(typeId: string) {
    if (!typeId) return;
    setDone(null);
    setLines((prev) => (prev.some((l) => l.typeId === typeId) ? prev.map((l) => (l.typeId === typeId ? { ...l, quantity: l.quantity + 1 } : l)) : [...prev, { typeId, quantity: 1 }]));
  }

  /** Takes what's free of the short line and fills the rest from another type in its category. */
  function swap(typeId: string, got: number, alt: { typeId: string; free: number }, shortBy: number) {
    setDone(null);
    setLines((prev) => {
      const next = prev.map((l) => (l.typeId === typeId ? { ...l, quantity: got } : l)).filter((l) => l.quantity > 0);
      const take = Math.min(shortBy, alt.free);
      const existing = next.find((l) => l.typeId === alt.typeId);
      return existing ? next.map((l) => (l.typeId === alt.typeId ? { ...l, quantity: l.quantity + take } : l)) : [...next, { typeId: alt.typeId, quantity: take }];
    });
  }

  function reserve() {
    if (!plan) return;
    setError(null);
    startReserving(async () => {
      if (editBatch) {
        const updated = await updateGearBatchAction({
          batchId: editBatch.batchId,
          lines: activeLines,
          startDate: start,
          endDate: end < start ? start : end,
          projectId: projectId || null,
          note,
          expectedUnits: plan.got,
        });
        if (updated.ok) onSaved?.();
        else {
          setError(gearError(t, updated.error));
          setRefreshKey((k) => k + 1);
        }
        return;
      }
      const result = await reserveGearAction({ lines: activeLines, startDate: start, endDate: end < start ? start : end, projectId: projectId || null, note, groupId, expectedUnits: plan.got });
      if (result.ok) {
        setDone(result);
      } else {
        setError(gearError(t, result.error));
      }
      setRefreshKey((k) => k + 1);
    });
  }

  if (!canReserve) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-[20px] font-bold tracking-tight">{title}</h2>
        <p className="text-[13px] placeholder-text">{t.noPermission}</p>
      </div>
    );
  }

  const buttonLabel = !plan
    ? editBatch
      ? dict.common.save
      : t.reserve
    : plan.got === plan.wanted
      ? editBatch
        ? t.saveReservation(plan.got)
        : t.reserveAll(plan.got)
      : editBatch
        ? t.saveReservationPartial(plan.got, plan.wanted)
        : t.reservePartial(plan.got, plan.wanted);

  return (
    <div className="flex flex-col gap-4">
      {title && <h2 className="text-[20px] font-bold tracking-tight">{title}</h2>}

      <label className="flex flex-col gap-1.5">
        <span className="field-label">{t.project}</span>
        <ProjectPicker
          name="projectId"
          initialEvents={projects}
          defaultValue={projectId}
          extraOption={{ value: "", label: t.noProjectOption }}
          onSelect={(id) => {
            setProjectId(id);
            setDone(null);
          }}
          t={dict.projects.picker}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="field-label">{t.note}</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder={projectId ? "" : t.notePlaceholder}
          className="input"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
          <span className="field-label">{t.from}</span>
          <input
            type="date"
            value={start}
            required
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              setStart(v);
              if (end < v) setEnd(v);
              setDone(null);
            }}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
          <span className="field-label">{t.to}</span>
          <input
            type="date"
            value={end}
            min={start}
            required
            onChange={(e) => {
              if (!e.target.value) return;
              setEnd(e.target.value);
              setDone(null);
            }}
            className="input"
          />
        </label>
      </div>
      <p className="text-[12.5px] placeholder-text -mt-1">
        {plan ? t.daysLine(plan.days) : preview && !preview.ok ? gearError(t, preview.error) : checking ? t.checking : " "}
      </p>

      {activeLines.length === 0 ? (
        <p className="text-[13px] placeholder-text">{editableLines ? t.pickGear : t.emptyGroupReserve}</p>
      ) : (
        <ul aria-busy={checking}>
          {(plan?.lines ?? activeLines.map((l) => ({ ...l, name: typeName.get(l.typeId) ?? "", units: [] as number[], shortBy: 0, busy: [], alternatives: [] }))).map((line) => {
            const got = line.units.length;
            const tone = !plan ? "placeholder-text" : line.shortBy === 0 ? "text-positive" : got > 0 ? "text-attention" : "text-warning";
            return (
              <li key={line.typeId} className="grid grid-cols-[22px_minmax(0,1fr)_auto] gap-3 py-3 border-t border-ink/10">
                <span className={`pt-0.5 ${tone}`}>{plan && (line.shortBy === 0 ? <CheckIcon /> : <WarningIcon />)}</span>
                <span className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[14px] font-semibold">
                    {line.quantity}× {line.name}
                  </span>
                  {plan && (
                    <span className={`text-[13px] ${tone}`}>
                      {line.shortBy === 0 ? t.unitsAssigned(line.units) : got > 0 ? t.onlyFree(got, line.units) : t.noneFree}
                    </span>
                  )}
                  {plan && line.shortBy > 0 && <span className="text-[12px] placeholder-text">{t.shortBy(line.shortBy, range)}</span>}
                  {plan &&
                    line.busy.slice(0, 2).map((b) => (
                      <span key={b.number} className="text-[12px] placeholder-text">
                        {t.bookedNote(b.number, formatDayRange(b.startDate, b.endDate, locale))}
                      </span>
                    ))}
                  {plan &&
                    line.alternatives.map((alt) => (
                      <button
                        key={alt.typeId}
                        type="button"
                        onClick={() => swap(line.typeId, got, alt, line.shortBy)}
                        className="self-start text-left text-[13px] font-semibold text-accent hover:underline mt-0.5"
                      >
                        {t.alternative(alt.name, alt.free, line.shortBy)}
                      </button>
                    ))}
                </span>
                {editableLines && (
                  <span className="flex items-center gap-1 self-start">
                    <button type="button" aria-label={`${t.decrease}: ${line.name}`} onClick={() => setQuantity(line.typeId, line.quantity - 1)} className="w-8 h-8 rounded-full border border-ink/16 hover:bg-ink/10">
                      −
                    </button>
                    <button type="button" aria-label={`${t.increase}: ${line.name}`} onClick={() => setQuantity(line.typeId, line.quantity + 1)} className="w-8 h-8 rounded-full border border-ink/16 hover:bg-ink/10">
                      +
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editableLines && (
        <select value="" onChange={(e) => addLine(e.target.value)} aria-label={t.addLine} className="input">
          <option value="">{t.addLine}</option>
          {types.map((x) => (
            <option key={x.id} value={x.id}>
              {x.category} · {x.name} ({t.unitsCount(x.units)})
            </option>
          ))}
        </select>
      )}

      {plan && (
        <div className="flex justify-between items-baseline gap-3 pt-3.5 border-t border-ink/10">
          <span className="text-[13px] placeholder-text">
            {t.totalLine(plan.got, plan.wanted, plan.days)} · {t.exclVat}
          </span>
          <span className="text-[20px] font-bold tabular-nums">{formatCurrency(plan.cost)}</span>
        </div>
      )}

      <button type="button" onClick={reserve} disabled={!plan || plan.got === 0 || reserving || checking} className="btn font-semibold min-h-[44px]">
        {reserving ? (editBatch ? t.savingReservation : t.reserving) : buttonLabel}
      </button>

      {error && (
        <p role="alert" className="text-[13px] text-warning">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="text-[13px] text-positive">
          {done.projectTitle ? t.reservedDone(done.count, done.projectTitle) : t.reservedDoneNoProject(done.count)}{" "}
          <Link href={done.href} className="underline font-semibold">
            {done.projectTitle ? t.viewOnProject : t.viewReservations}
          </Link>
        </p>
      )}
    </div>
  );
}
