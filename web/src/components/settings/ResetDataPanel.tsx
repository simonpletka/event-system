"use client";

import { useActionState } from "react";
import { deleteAllDataAction, type ResetDataState } from "@/lib/actions/reset-data";
import { getDictionary, type Locale } from "@/lib/dictionary";

const EMPTY: ResetDataState = {};

// Admin-only, at the bottom of Settings → Company. The typed word is checked
// on the server, so there's no client-side confirm() to race the form action.
export function ResetDataPanel({ locale, testMode }: { locale: Locale; testMode: boolean }) {
  const t = getDictionary(locale).settings.resetData;
  const [state, formAction, pending] = useActionState(deleteAllDataAction, EMPTY);

  return (
    <div className="mt-6">
      <div className="heading-label !text-[12px] mb-2 !text-warning">{t.heading}</div>
      <div className="card p-3.5 text-[13px] !border-warning/40">
        {testMode ? (
          <p className="placeholder-text">{t.testingNote}</p>
        ) : state.done ? (
          <p>{t.done}</p>
        ) : (
          <form action={formAction} className="flex flex-col gap-3">
            <p className="placeholder-text">{t.body}</p>
            <div className="flex items-end gap-3 flex-wrap">
              <label className="flex flex-col gap-1.5">
                <span className="field-label">{t.confirmLabel(t.confirmWord)}</span>
                <input name="confirm" autoComplete="off" spellCheck={false} className="input !py-2 w-48" />
              </label>
              <button type="submit" disabled={pending} className="btn !bg-warning !border-warning">
                {pending ? t.deleting : t.button}
              </button>
            </div>
            {state.error && <p className="text-warning">{state.error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
