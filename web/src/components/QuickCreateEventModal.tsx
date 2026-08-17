"use client";

import { useActionState, useEffect } from "react";
import { quickCreateEventAction, type QuickEventState } from "@/lib/actions/events";
import { Modal } from "@/components/ui/Modal";

const initialState: QuickEventState = {};

export function QuickCreateEventModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (event: { id: string; title: string; companyName: string; quotedValue: number }) => void;
}) {
  const [state, formAction, pending] = useActionState(quickCreateEventAction, initialState);

  useEffect(() => {
    if (state.event) onCreated(state.event);
    // onCreated unmounts this modal once called, so it can't double-fire — safe to omit from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.event]);

  return (
    <Modal title="New event" onClose={onClose}>
      <p className="text-[10px] placeholder-text mb-3">
        Just enough to pick it here — add the brief, venues and full client details later from the event page.
      </p>
      <form action={formAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">Title</span>
          <input name="title" required autoFocus className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">Client contact name</span>
          <input name="clientName" required className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">Client company</span>
          <input name="companyName" required className="input" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="heading-label">Start</span>
            <input name="startDate" type="datetime-local" required className="input" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="heading-label">End</span>
            <input name="endDate" type="datetime-local" required className="input" />
          </label>
        </div>

        {state.error && <p className="text-sm text-accent">{state.error}</p>}

        <div className="flex gap-2 mt-1">
          <button type="submit" disabled={pending} className="btn">
            {pending ? "Creating…" : "Create event"}
          </button>
          <button type="button" onClick={onClose} className="btno">
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
