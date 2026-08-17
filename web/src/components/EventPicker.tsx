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
}: {
  name: string;
  initialEvents: PickableEvent[];
  defaultValue?: string;
  required?: boolean;
  /** e.g. Expenses' "Company overhead — not tied to an event" option, shown above the event list. */
  extraOption?: { value: string; label: string };
}) {
  const [events, setEvents] = useState(initialEvents);
  const [selected, setSelected] = useState(defaultValue ?? "");
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="flex gap-1.5">
      <select
        name={name}
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
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
            setSelected(event.id);
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
