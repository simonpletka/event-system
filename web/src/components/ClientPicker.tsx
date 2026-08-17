"use client";

import { useState } from "react";
import { QuickCreateClientModal } from "@/components/QuickCreateClientModal";

export type PickableClient = { id: string; name: string; address?: string; ico?: string; dic?: string };

export function ClientPicker({
  initialClients,
  defaultValue,
  onSelect,
}: {
  initialClients: PickableClient[];
  defaultValue?: string;
  /** Fired with the full client record (or null for "not linked") so the caller can pre-fill company fields. */
  onSelect: (client: PickableClient | null) => void;
}) {
  const [clients, setClients] = useState(initialClients);
  const [selected, setSelected] = useState(defaultValue ?? "");
  const [modalOpen, setModalOpen] = useState(false);

  function select(id: string) {
    setSelected(id);
    onSelect(id ? (clients.find((c) => c.id === id) ?? null) : null);
  }

  return (
    <div className="flex gap-1.5">
      <select name="clientId" value={selected} onChange={(e) => select(e.target.value)} className="input flex-1">
        <option value="">Not linked</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => setModalOpen(true)} className="btno text-[9px] whitespace-nowrap">
        + New client
      </button>
      {modalOpen && (
        <QuickCreateClientModal
          onClose={() => setModalOpen(false)}
          onCreated={(client) => {
            setClients((prev) => [...prev, client]);
            select(client.id);
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
