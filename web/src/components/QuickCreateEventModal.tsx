"use client";

import { useActionState, useEffect } from "react";
import { quickCreateEventAction, type QuickEventState } from "@/lib/actions/events";
import { Modal } from "@/components/ui/Modal";
import type { Dictionary } from "@/lib/dictionary";

const initialState: QuickEventState = {};

type T = Dictionary["events"]["picker"];

export function QuickCreateEventModal({
  onClose,
  onCreated,
  t,
}: {
  onClose: () => void;
  onCreated: (event: { id: string; title: string; companyName: string; quotedValue: number }) => void;
  t: T;
}) {
  const [state, formAction, pending] = useActionState(quickCreateEventAction, initialState);

  useEffect(() => {
    if (state.event) onCreated(state.event);
    // onCreated unmounts this modal once called, so it can't double-fire — safe to omit from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.event]);

  return (
    <Modal title={t.quickCreateTitle} onClose={onClose}>
      <p className="text-[10px] placeholder-text mb-3">{t.quickCreateHelper}</p>
      <form action={formAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{t.titleLabel}</span>
          <input name="title" required autoFocus className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{t.clientContactLabel}</span>
          <input name="clientName" required className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{t.clientCompanyLabel}</span>
          <input name="companyName" required className="input" />
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="field-label">{t.startLabel}</span>
            <input name="startDate" type="datetime-local" required className="input" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">{t.endLabel}</span>
            <input name="endDate" type="datetime-local" required className="input" />
          </label>
        </div>

        {state.error && <p className="text-sm text-warning">{state.error}</p>}

        <div className="flex gap-2 mt-1">
          <button type="submit" disabled={pending} className="btn">
            {pending ? t.creating : t.createEvent}
          </button>
          <button type="button" onClick={onClose} className="btno">
            {t.cancel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
