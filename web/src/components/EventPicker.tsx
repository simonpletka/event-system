"use client";

import { useState } from "react";
import { QuickCreateEventModal } from "@/components/QuickCreateEventModal";

export type PickableEvent = { id: string; title: string; companyName: string };

export function EventPicker({
  name,
  initialEvents,
  defaultValue,
  required,
  extraOption,
  onSelect,
}: {
  name: string;
  initialEvents: PickableEvent[];
  defaultValue?: string;
  required?: boolean;
  /** e.g. Expenses' "Company overhead — not tied to an event" option, shown above the event list. */
  extraOption?: { value: string; label: string };
  /** Fired whenever the selected event id changes (incl. right after a quick-create). */
  onSelect?: (eventId: string) => void;
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
            Select an event…
          </option>
        )}
        {extraOption && <option value={extraOption.value}>{extraOption.label}</option>}
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {e.title} — {e.companyName}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => setModalOpen(true)} className="btno text-[9px] whitespace-nowrap">
        + New event
      </button>
      {modalOpen && (
        <QuickCreateEventModal
          onClose={() => setModalOpen(false)}
          onCreated={(event) => {
            setEvents((prev) => [...prev, event]);
            select(event.id);
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
