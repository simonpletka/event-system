"use client";

import { useActionState, useEffect, useState } from "react";
import { addClientContactAction, type ContactFormState } from "@/lib/actions/clients";
import { Modal } from "@/components/ui/Modal";

const initialState: ContactFormState = {};

export function AddContactButton({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btno text-[9px]">
        + New contact
      </button>
      {open && <AddContactModal clientId={clientId} onClose={() => setOpen(false)} />}
    </>
  );
}

function AddContactModal({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(addClientContactAction, initialState);

  useEffect(() => {
    if (state.success) onClose();
    // onClose unmounts this modal once called, so it can't double-fire — safe to omit from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <Modal title="New contact" onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="clientId" value={clientId} />
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">Name</span>
          <input name="name" required autoFocus className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">Role</span>
          <input name="role" className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">Phone</span>
          <input name="phone" className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">Email</span>
          <input name="email" type="email" className="input" />
        </label>

        {state.error && <p className="text-sm text-warning">{state.error}</p>}

        <div className="flex gap-2 mt-1">
          <button type="submit" disabled={pending} className="btn">
            {pending ? "Adding…" : "Add contact"}
          </button>
          <button type="button" onClick={onClose} className="btno">
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
