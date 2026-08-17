"use client";

import { useState } from "react";

export type PickableClient = { id: string; name: string; address?: string; ico?: string; dic?: string };

export function ClientPicker({
  initialClients,
  defaultValue,
  onSelect,
}: {
  initialClients: PickableClient[];
  defaultValue?: string;
  /** Fired with the full client record (or null for "create a new one from the fields below") so the caller can pre-fill company fields. */
  onSelect: (client: PickableClient | null) => void;
}) {
  const [selected, setSelected] = useState(defaultValue ?? "");

  function select(id: string) {
    setSelected(id);
    onSelect(id ? (initialClients.find((c) => c.id === id) ?? null) : null);
  }

  return (
    <select name="clientId" value={selected} onChange={(e) => select(e.target.value)} className="input">
      <option value="">New client — from the company info below</option>
      {initialClients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
