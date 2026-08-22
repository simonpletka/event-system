"use client";

import { useActionState, useState } from "react";
import { updateAppSettingsAction, type SettingsFormState } from "@/lib/actions/settings";
import { DEFAULT_COLORS } from "@/lib/theme";
import type { Locale, Dictionary } from "@/lib/dictionary";

const initialState: SettingsFormState = {};

type AppSettings = {
  bgColor: string;
  surfaceColor: string;
  inkColor: string;
  accentColor: string;
  positiveColor: string;
  warningColor: string;
  locale: Locale;
};

type T = Dictionary["settings"]["appSettings"];

export function AppSettingsForm({ defaults, t }: { defaults: AppSettings; t: T }) {
  const [state, formAction, pending] = useActionState(updateAppSettingsAction, initialState);
  const [fields, setFields] = useState<AppSettings>(defaults);

  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  const colorFields: { formKey: "bgColor" | "surfaceColor" | "inkColor" | "accentColor" | "positiveColor" | "warningColor"; label: string; hint: string }[] = [
    { formKey: "bgColor", label: t.background, hint: t.backgroundHint },
    { formKey: "surfaceColor", label: t.surface, hint: t.surfaceHint },
    { formKey: "inkColor", label: t.textBorders, hint: t.textBordersHint },
    { formKey: "accentColor", label: t.accent, hint: t.accentHint },
    { formKey: "positiveColor", label: t.positive, hint: t.positiveHint },
    { formKey: "warningColor", label: t.warning, hint: t.warningHint },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-5 max-w-3xl">
      <form action={formAction} className="card p-5 flex flex-col gap-3">
        <div className="heading-label">{t.coloursHeading}</div>
        <p className="text-[10px] placeholder-text -mt-1 max-w-prose">{t.coloursIntro}</p>

        <div className="flex flex-col gap-3 mt-1">
          {colorFields.map((f) => (
            <label key={f.formKey} className="flex items-center gap-2.5 text-[11px]">
              <input
                type="color"
                value={fields[f.formKey]}
                onChange={(e) => set(f.formKey, e.target.value)}
                className="w-8 h-6 rounded-md border border-ink/30 p-0 bg-transparent shrink-0"
              />
              <input
                name={f.formKey}
                value={fields[f.formKey]}
                onChange={(e) => set(f.formKey, e.target.value)}
                className="input w-24 text-[11px] shrink-0"
              />
              <div className="min-w-0">
                <div className="font-medium">{f.label}</div>
                <div className="text-[9px] placeholder-text">{f.hint}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="flex gap-1.5 mt-1">
          {colorFields.map((f) => (
            <div key={f.formKey} title={f.label} className="w-7 h-7 rounded-full border border-ink/20" style={{ background: fields[f.formKey] }} />
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            setFields((f) => ({
              ...f,
              bgColor: DEFAULT_COLORS.bg,
              surfaceColor: DEFAULT_COLORS.surface,
              inkColor: DEFAULT_COLORS.ink,
              accentColor: DEFAULT_COLORS.accent,
              positiveColor: DEFAULT_COLORS.positive,
              warningColor: DEFAULT_COLORS.warning,
            }))
          }
          className="btno self-start text-[9px]"
        >
          {t.resetToDefaults}
        </button>

        <div className="heading-label mt-2">{t.languageHeading}</div>
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 text-[13px]">
            <input type="radio" name="locale" value="en" checked={fields.locale === "en"} onChange={() => set("locale", "en")} />
            {t.english}
          </label>
          <label className="flex items-center gap-1.5 text-[13px]">
            <input type="radio" name="locale" value="cs" checked={fields.locale === "cs"} onChange={() => set("locale", "cs")} />
            {t.czech}
          </label>
        </div>
        <span className="text-[9px] placeholder-text -mt-1">{t.appliesWholeApp}</span>

        {state.error && <p className="text-sm text-warning">{state.error}</p>}
        {state.success && <p className="text-sm">{state.success}</p>}

        <div className="flex gap-2 mt-1">
          <button type="submit" disabled={pending} className="btn">
            {pending ? t.saving : t.saveChanges}
          </button>
          <button type="button" onClick={() => setFields(defaults)} className="btno">
            {t.cancel}
          </button>
        </div>
      </form>

      <div className="card p-5 self-start">
        <div className="heading-label mb-2">{t.previewHeading}</div>
        <p className="text-[10px] placeholder-text max-w-xs">{t.previewNote}</p>
      </div>
    </div>
  );
}
