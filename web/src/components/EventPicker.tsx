"use client";

import { useState } from "react";
import { QuickCreateEventModal } from "@/components/QuickCreateEventModal";
import type { Dictionary } from "@/lib/dictionary";

export type PickableEvent = { id: string; title: string; companyName: string; quotedValue?: number };

type T = Dictionary["events"]["picker"];

export function EventPicker({
  name,
  initialEvents,
  defaultValue,
  required,
  extraOption,
  onSelect,
  t,
}: {
  name: string;
  initialEvents: PickableEvent[];
  defaultValue?: string;
  required?: boolean;
  /** e.g. Expenses' "Company overhead — not tied to an event" option, shown above the event list. */
  extraOption?: { value: string; label: string };
  /** Fired whenever the selected event id changes (incl. right after a quick-create). */
  onSelect?: (eventId: string) => void;
  t: T;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [selected, setSelected] = useState(defaultValue ?? "");
  const [modalOpen, setModalOpen] = useState(false);

  function select(id: string) {
    setSelected(id);
    onSelect?.(id);
  }

  return (
    <div className="flex gap-1.5">
      <select
        name={name}
        value={selected}
        onChange={(e) => select(e.target.value)}
        required={required}
        className="input flex-1"
      >
        {!extraOption && (
          <option value="" disabled>
            {t.selectEvent}
          </option>
        )}
        {extraOption && <option value={extraOption.value}>{extraOption.label}</option>}
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {e.title} — {e.companyName}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => setModalOpen(true)} className="btno font-semibold text-[9px] whitespace-nowrap">
        {t.newEventBtn}
      </button>
      {modalOpen && (
        <QuickCreateEventModal
          onClose={() => setModalOpen(false)}
          onCreated={(event) => {
            setEvents((prev) => [...prev, event]);
            select(event.id);
            setModalOpen(false);
          }}
          t={t}
        />
      )}
    </div>
  );
}
