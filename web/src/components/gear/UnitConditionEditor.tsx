"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/dictionary";
import { setGearUnitConditionAction } from "@/lib/actions/gear-units";
import type { GearConditionValue } from "@/lib/gear-reservations";
import { gearError } from "./CategoryManager";

const CONDITIONS: GearConditionValue[] = ["OK", "NEEDS_ATTENTION", "DAMAGED", "IN_SERVICE", "LOST", "RETIRED"];

/** Gear managers set a unit's condition here, with a note and, for In service, when it's back. */
export function UnitConditionEditor({
  unitId,
  condition,
  note,
  backAt,
  locale,
  compact = false,
}: {
  unitId: string;
  condition: GearConditionValue;
  note: string | null;
  backAt: string | null;
  locale: Locale;
  compact?: boolean;
}) {
  const t = getDictionary(locale).gear;
  const router = useRouter();
  const [value, setValue] = useState<GearConditionValue>(condition);
  const [text, setText] = useState(note ?? "");
  const [back, setBack] = useState(backAt ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const changed = value !== condition || text !== (note ?? "") || back !== (backAt ?? "");

  return (
    <div className={`flex flex-col gap-2.5 ${compact ? "" : "p-4 rounded-2xl bg-ink/5"}`}>
      <label className="flex flex-col gap-1.5">
        <span className="field-label">{t.conditionLabel}</span>
        <select value={value} onChange={(e) => setValue(e.target.value as GearConditionValue)} className="input min-h-[44px]">
          {CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {t.condition[c]}
            </option>
          ))}
        </select>
      </label>
      <p className="text-[12px] placeholder-text -mt-1">{t.conditionHelp[value]}</p>
      {value === "IN_SERVICE" && (
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{t.backAt}</span>
          <input type="date" value={back} onChange={(e) => setBack(e.target.value)} className="input min-h-[44px]" />
        </label>
      )}
      {value !== "OK" && (
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{t.conditionNote}</span>
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} className="input min-h-[44px]" />
        </label>
      )}
      {error && <p className="text-[12.5px] text-warning">{error}</p>}
      {changed && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await setGearUnitConditionAction({ unitId, condition: value, note: value === "OK" ? "" : text, backAt: value === "IN_SERVICE" ? back || null : null });
              if (r.ok) {
                setError(null);
                router.refresh();
              } else setError(gearError(t, r.error));
            })
          }
          className="btn self-start min-h-[44px]"
        >
          {t.saveCondition}
        </button>
      )}
    </div>
  );
}
