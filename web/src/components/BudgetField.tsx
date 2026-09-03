"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import { getDictionary, type Locale } from "@/lib/dictionary";
import type { BudgetType } from "@/generated/prisma/enums";

/**
 * The Admin-only "Event budget" field on the event form. Emits three form
 * fields the action reads: `budgetType` (NONE|PERCENT|FIXED) plus
 * `budgetPercent` / `budgetAmount`. Shows a live resolved figure against the
 * project's quoted value — a fixed number for the life of this form, since
 * quotedValue is derived (latest quote, else invoice) and read-only here,
 * not something this form can change.
 */
export function BudgetField({
  locale,
  quotedValue,
  defaultType,
  defaultValue,
}: {
  locale: Locale;
  quotedValue: number;
  defaultType: BudgetType;
  defaultValue: number;
}) {
  const tf = getDictionary(locale).projects.form;
  const [mode, setMode] = useState<BudgetType>(defaultType);
  const [pct, setPct] = useState(defaultType === "PERCENT" ? defaultValue : 70);
  const [amount, setAmount] = useState(defaultType === "FIXED" ? defaultValue : 0);

  function pickMode(next: BudgetType) {
    // Carry the current figure across so switching mode never silently zeroes
    // the budget: % -> fixed seeds the resolved amount, fixed -> % seeds the
    // equivalent percentage.
    if (next === "FIXED" && amount === 0) setAmount(Math.round((quotedValue * pct) / 100));
    if (next === "PERCENT" && pct === 0 && amount > 0 && quotedValue > 0) setPct(Math.round((amount / quotedValue) * 100));
    setMode(next);
  }

  const resolved = mode === "PERCENT" ? Math.round((quotedValue * pct) / 100) : mode === "FIXED" ? amount : null;
  const approxPct = quotedValue > 0 && resolved !== null ? Math.round((resolved / quotedValue) * 100) : 0;

  const modes: { key: BudgetType; label: string }[] = [
    { key: "PERCENT", label: tf.budgetModePercent },
    { key: "FIXED", label: tf.budgetModeFixed },
    { key: "NONE", label: tf.budgetModeNone },
  ];

  return (
    <div className="flex flex-col gap-1">
      <span className="field-label">
        {tf.budgetLabel} <span className="placeholder-text">— {tf.budgetHint}</span>
      </span>

      <input type="hidden" name="budgetType" value={mode} />
      <input type="hidden" name="budgetPercent" value={mode === "PERCENT" ? pct : ""} />
      <input type="hidden" name="budgetAmount" value={mode === "FIXED" ? amount : ""} />

      <div className="inline-flex self-start p-[3px] rounded-full border border-ink/12 bg-ink/4 gap-0.5">
        {modes.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => pickMode(m.key)}
            className={`text-[10px] font-semibold tracking-[0.08em] uppercase px-3 py-1.5 rounded-full transition-colors ${
              mode === m.key ? "bg-ink/14 text-ink" : "text-ink/55 hover:text-ink/80"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "PERCENT" && (
        <div className="flex items-center gap-3 mt-2">
          <input
            type="range"
            min={0}
            max={150}
            step={5}
            value={Math.min(150, pct)}
            onChange={(e) => setPct(Number(e.target.value))}
            className="flex-1 accent-accent"
            aria-label={tf.budgetModePercent}
          />
          <div className="flex items-center gap-1.5 input !py-1.5 !w-[92px]">
            <input
              type="number"
              min={0}
              max={300}
              value={pct}
              onChange={(e) => setPct(Math.max(0, Math.min(300, Number(e.target.value) || 0)))}
              className="w-full bg-transparent outline-none text-right tabular-nums"
            />
            <span className="placeholder-text">%</span>
          </div>
        </div>
      )}

      {mode === "FIXED" && (
        <div className="flex items-center gap-1.5 input mt-2 !py-1.5 !w-[180px]">
          <input
            type="number"
            min={0}
            step={1000}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
            className="w-full bg-transparent outline-none text-right tabular-nums"
          />
          <span className="placeholder-text">Kč</span>
        </div>
      )}

      <p className="text-[11px] placeholder-text mt-2">
        {resolved === null
          ? tf.budgetResolvedNone
          : `${tf.budgetResolved(formatCurrency(resolved))} · ${
              mode === "PERCENT"
                ? tf.budgetResolvedPercentNote(pct, formatCurrency(quotedValue))
                : tf.budgetResolvedFixedNote(approxPct, formatCurrency(quotedValue))
            }`}
      </p>
    </div>
  );
}
