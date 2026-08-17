"use client";

import { useActionState, useEffect, useState } from "react";
import { quickCreateClientAction, type QuickClientState } from "@/lib/actions/clients";
import { Modal } from "@/components/ui/Modal";
import { AddressAutocompleteInput } from "@/components/ui/AddressAutocompleteInput";

const initialState: QuickClientState = {};

export function QuickCreateClientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (client: { id: string; name: string; address: string; ico: string; dic: string }) => void;
}) {
  const [state, formAction, pending] = useActionState(quickCreateClientAction, initialState);
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (state.client) onCreated(state.client);
    // onCreated unmounts this modal once called, so it can't double-fire — safe to omit from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.client]);

  return (
    <Modal title="New client" onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">Company name</span>
          <input name="name" required autoFocus className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">Address</span>
          <AddressAutocompleteInput name="address" value={address} onChange={setAddress} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="heading-label">IČO</span>
            <input name="ico" className="input" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="heading-label">DIČ</span>
            <input name="dic" className="input" />
          </label>
        </div>

        {state.error && <p className="text-sm text-accent">{state.error}</p>}

        <div className="flex gap-2 mt-1">
          <button type="submit" disabled={pending} className="btn">
            {pending ? "Creating…" : "Create client"}
          </button>
          <button type="button" onClick={onClose} className="btno">
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
