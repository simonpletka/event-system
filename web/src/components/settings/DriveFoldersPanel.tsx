"use client";

import { useActionState } from "react";
import { createMissingProjectFoldersAction, type DriveBackfillState } from "@/lib/actions/projects";
import { getDictionary, type Locale } from "@/lib/dictionary";

const EMPTY: DriveBackfillState = {};

export function DriveFoldersPanel({ configured, missing, locale }: { configured: boolean; missing: number; locale: Locale }) {
  const t = getDictionary(locale).settings.drive;
  const [state, formAction, pending] = useActionState(createMissingProjectFoldersAction, EMPTY);

  return (
    <div className="mt-6">
      <div className="heading-label !text-[12px] mb-2">{t.heading}</div>
      <div className="card p-3.5 text-[13px]">
        {!configured ? (
          <p className="placeholder-text">{t.notConnected}</p>
        ) : (
          <form action={formAction} className="flex items-center justify-between gap-3 flex-wrap">
            <p>{missing > 0 ? t.missing(missing) : t.allDone}</p>
            <button type="submit" className="btno" disabled={pending}>
              {pending ? t.creating : t.create}
            </button>
          </form>
        )}
        {state.error ? (
          <p className="text-warning mt-2">{t.stopped(state.created ?? 0, state.error)}</p>
        ) : (
          state.created != null && <p className="placeholder-text mt-2">{t.created(state.created)}</p>
        )}
      </div>
    </div>
  );
}
