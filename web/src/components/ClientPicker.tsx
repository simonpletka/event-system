"use client";

import { useState } from "react";

export type PickableClient = {
  id: string;
  name: string;
  street?: string;
  city?: string;
  postCode?: string;
  state?: string;
  ico?: string;
  dic?: string;
};

export function ClientPicker({
  initialClients,
  defaultValue,
  onSelect,
  newClientOptionLabel = "New client — from the company info below",
}: {
  initialClients: PickableClient[];
  defaultValue?: string;
  /** Fired with the full client record (or null for "create a new one from the fields below") so the caller can pre-fill company fields. */
  onSelect: (client: PickableClient | null) => void;
  newClientOptionLabel?: string;
}) {
  const [selected, setSelected] = useState(defaultValue ?? "");

  function select(id: string) {
    setSelected(id);
    onSelect(id ? (initialClients.find((c) => c.id === id) ?? null) : null);
  }

  return (
    <select name="clientId" value={selected} onChange={(e) => select(e.target.value)} className="input">
      <option value="">{newClientOptionLabel}</option>
      {initialClients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
