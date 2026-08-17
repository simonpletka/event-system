"use client";

import { useActionState, useState } from "react";
import { createClientAction, updateClientAction, type ClientFormState } from "@/lib/actions/clients";
import { CancelLink } from "@/components/ui/CancelLink";
import { AddressAutocompleteInput } from "@/components/ui/AddressAutocompleteInput";

const initialState: ClientFormState = {};

export type ClientFormDefaults = { id?: string; name: string; address: string; ico: string; dic: string; note: string };

export function ClientForm({ defaults }: { defaults: ClientFormDefaults }) {
  const isEdit = Boolean(defaults.id);
  const action = isEdit ? updateClientAction : createClientAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [address, setAddress] = useState(defaults.address);

  return (
    <form action={formAction} className="max-w-lg flex flex-col gap-4">
      {isEdit && <input type="hidden" name="id" value={defaults.id} />}

      <label className="flex flex-col gap-1.5">
        <span className="heading-label">Company name</span>
        <input name="name" defaultValue={defaults.name} required autoFocus className="input" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="heading-label">Address</span>
        <AddressAutocompleteInput name="address" value={address} onChange={setAddress} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">IČO</span>
          <input name="ico" defaultValue={defaults.ico} className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">DIČ</span>
          <input name="dic" defaultValue={defaults.dic} className="input" />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="heading-label">Note</span>
        <textarea name="note" defaultValue={defaults.note} rows={3} className="input" />
      </label>

      {state.error && <p className="text-sm text-accent">{state.error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn">
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create client"}
        </button>
        <CancelLink href={isEdit ? `/clients/${defaults.id}` : "/clients"} />
      </div>
    </form>
  );
}
