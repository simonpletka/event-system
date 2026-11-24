"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/dictionary";
import { updateGearIssueAction } from "@/lib/actions/gear-units";
import { gearError } from "./CategoryManager";

const STATUSES = ["OPEN", "IN_SERVICE", "RESOLVED", "WONT_FIX"] as const;

/** Status, resolution note and repair cost of one issue. Gear managers only. */
export function IssueEditor({
  issue,
  locale,
}: {
  issue: { id: string; status: (typeof STATUSES)[number]; resolutionNote: string | null; repairCost: number | null };
  locale: Locale;
}) {
  const t = getDictionary(locale).gear;
  const router = useRouter();
  const [status, setStatus] = useState(issue.status);
  const [note, setNote] = useState(issue.resolutionNote ?? "");
  const [cost, setCost] = useState(issue.repairCost != null ? String(issue.repairCost) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const changed = status !== issue.status || note !== (issue.resolutionNote ?? "") || cost !== (issue.repairCost != null ? String(issue.repairCost) : "");

  return (
    <div className="flex flex-col gap-2 p-3 rounded-2xl bg-ink/5">
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col gap-1 flex-[1_1_150px]">
          <span className="field-label">{t.issueStatusLabel}</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])} className="input min-h-[44px]">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t.issueStatus[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 flex-[1_1_150px]">
          <span className="field-label">{t.repairCost}</span>
          <input inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value.replace(/[^\d]/g, ""))} className="input min-h-[44px]" />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="field-label">{t.resolutionNote}</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} className="input min-h-[44px]" />
      </label>
      {error && <p className="text-[12.5px] text-warning">{error}</p>}
      {changed && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await updateGearIssueAction({ issueId: issue.id, status, resolutionNote: note, repairCost: cost === "" ? null : Number(cost) });
              if (r.ok) {
                setError(null);
                router.refresh();
              } else setError(gearError(t, r.error));
            })
          }
          className="btn self-start min-h-[40px]"
        >
          {t.saveIssue}
        </button>
      )}
    </div>
  );
}
