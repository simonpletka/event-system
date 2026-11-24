"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/dictionary";
import { reportGearIssueAction, setGearUnitConditionAction } from "@/lib/actions/gear-units";
import { gearError } from "./CategoryManager";

type Severity = "MINOR" | "MAJOR" | "UNUSABLE";

/**
 * Report a problem with a unit. Phone-first: big targets, and the photo input
 * opens the camera (`capture`). Photos go one by one to the upload route
 * after the report is saved (server actions cap bodies at 1MB). When the
 * reporter manages gear and chose Unusable, it offers to mark the unit
 * Damaged; it never does that by itself.
 */
export function ReportIssueForm({
  locale,
  unit,
  units,
  projectId = null,
  reservationId = null,
  markReturned = false,
  canManage,
  onDone,
}: {
  locale: Locale;
  /** The unit, when the form is opened from it. */
  unit?: { id: string; label: string };
  /** Choices when no unit is given. */
  units?: { id: string; label: string }[];
  projectId?: string | null;
  reservationId?: string | null;
  /** Part of returning the unit: mark it returned with the report. */
  markReturned?: boolean;
  canManage: boolean;
  onDone?: () => void;
}) {
  const t = getDictionary(locale).gear;
  const router = useRouter();
  const [unitId, setUnitId] = useState(unit?.id ?? "");
  const [severity, setSeverity] = useState<Severity>("MINOR");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [sent, setSent] = useState<{ unitId: string; severity: Severity; photoFailed: boolean } | null>(null);
  const [marked, setMarked] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function submit() {
    setError(null);
    if (!unitId) {
      setError(t.chooseUnit);
      return;
    }
    if (!description.trim()) {
      setError(t.descriptionRequired);
      return;
    }
    startTransition(async () => {
      setProgress(t.sending);
      const result = await reportGearIssueAction({ unitId, severity, description, projectId, reservationId, markReturned });
      if (!result.ok) {
        setProgress(null);
        setError(gearError(t, result.error));
        return;
      }
      let photoFailed = false;
      for (let i = 0; i < files.length; i++) {
        setProgress(t.uploadingPhotos(i + 1, files.length));
        const fd = new FormData();
        fd.set("file", files[i]);
        fd.set("issueId", result.issueId);
        const res = await fetch("/api/uploads/gear-issue-photos", { method: "POST", body: fd }).catch(() => null);
        if (!res?.ok) photoFailed = true;
      }
      setProgress(null);
      setSent({ unitId, severity, photoFailed });
      router.refresh();
    });
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="text-[15px] text-positive font-semibold">
          {t.reportSent}
        </p>
        {sent.photoFailed && <p className="text-[13px] text-warning">{t.photoFailed}</p>}
        {canManage && sent.severity === "UNUSABLE" && !marked && (
          <div className="p-4 rounded-2xl bg-warning/10 flex flex-col gap-2.5">
            <p className="text-[13.5px]">{t.markDamagedHint}</p>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await setGearUnitConditionAction({ unitId: sent.unitId, condition: "DAMAGED", note: description.slice(0, 300) });
                  if (r.ok) {
                    setMarked(true);
                    router.refresh();
                  }
                })
              }
              className="btn min-h-[44px] self-start"
            >
              {t.markDamaged}
            </button>
          </div>
        )}
        {onDone && (
          <button type="button" onClick={onDone} className="btno self-start min-h-[44px]">
            {getDictionary(locale).common.close}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {!unit && (
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{t.reportUnit}</span>
          <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className="input min-h-[46px]">
            <option value="">{t.chooseUnit}</option>
            {(units ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {unit && <p className="text-[15px] font-semibold">{unit.label}</p>}

      <fieldset className="flex flex-col gap-2">
        <legend className="field-label mb-1.5">{t.severityLabel}</legend>
        <div className="grid grid-cols-3 gap-2">
          {(["MINOR", "MAJOR", "UNUSABLE"] as const).map((s) => (
            <label
              key={s}
              className={`grid place-items-center min-h-[48px] rounded-2xl border text-[13px] font-semibold cursor-pointer text-center px-2 ${
                severity === s ? (s === "UNUSABLE" ? "bg-warning/20 border-warning text-ink" : "bg-accent/20 border-accent text-ink") : "border-ink/16 text-ink/70 hover:bg-ink/5"
              }`}
            >
              <input type="radio" name="severity" value={s} checked={severity === s} onChange={() => setSeverity(s)} className="sr-only" />
              {t.severity[s]}
            </label>
          ))}
        </div>
        <button type="button" onClick={() => setSeverity("UNUSABLE")} className="self-start text-[13px] font-semibold text-warning hover:underline py-1">
          {t.thinkUnusable}
        </button>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="field-label">{t.description}</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder={t.descriptionPlaceholder} className="input resize-none text-[15px]" />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="field-label">{t.photos}</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="sr-only"
          aria-label={t.addPhotos}
          onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 10))}
        />
        <button type="button" onClick={() => fileRef.current?.click()} className="btno min-h-[48px] self-start">
          {t.addPhotos}
        </button>
        {files.length > 0 && <span className="text-[12.5px] placeholder-text">{t.photosChosen(files.length)}</span>}
      </div>

      {error && (
        <p role="alert" className="text-[13px] text-warning">
          {error}
        </p>
      )}
      <button type="button" onClick={submit} disabled={pending} className="btn min-h-[48px] font-semibold">
        {pending ? (progress ?? t.sending) : t.sendReport}
      </button>
    </div>
  );
}
