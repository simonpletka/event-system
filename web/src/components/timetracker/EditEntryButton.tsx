"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { EditEntryForm } from "@/components/timetracker/EditEntryForm";
import type { TimePhase } from "@/generated/prisma/enums";
import type { Dictionary } from "@/lib/dictionary";

type T = Dictionary["timeTracker"]["editEntryForm"];
type TPhases = Dictionary["phases"];
type TDelete = Dictionary["timeTracker"]["deleteEntry"];

export type EditableEntry = {
  id: string;
  eventId: string | null;
  date: string;
  minutes: number;
  description: string;
  phase: TimePhase;
  startTime?: string;
  endTime?: string;
};

/**
 * Popup edit for a time entry — replaces the old dedicated
 * /time-tracker/entries/[id]/edit page (per explicit request: editing
 * shouldn't navigate away). `children`/`className`/`style` describe the
 * clickable trigger (a text link in the list rows, a whole calendar block
 * elsewhere) — deliberately plain props/ReactNode rather than a render-prop
 * function, since this component is also used from Server Component callers
 * (tracking/page.tsx) and a function can't cross that boundary.
 */
export function EditEntryButton({
  entry,
  events,
  modalTitle,
  t,
  tPhases,
  tDelete,
  className,
  style,
  title,
  children,
}: {
  entry: EditableEntry;
  events: { id: string; title: string }[];
  modalTitle: string;
  t: T;
  tPhases: TPhases;
  tDelete: TDelete;
  className?: string;
  style?: CSSProperties;
  title?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} style={style} title={title}>
        {children}
      </button>
      {open && (
        <Modal title={modalTitle} onClose={() => setOpen(false)} closeLabel={t.cancel}>
          <EditEntryForm
            id={entry.id}
            eventId={entry.eventId}
            events={events}
            date={entry.date}
            minutes={entry.minutes}
            description={entry.description}
            phase={entry.phase}
            startTime={entry.startTime}
            endTime={entry.endTime}
            onSaved={() => setOpen(false)}
            onCancel={() => setOpen(false)}
            t={t}
            tPhases={tPhases}
            tDelete={tDelete}
          />
        </Modal>
      )}
    </>
  );
}
