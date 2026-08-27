"use client";

import { useActionState, useEffect, useState } from "react";
import { addClientContactAction, type ContactFormState } from "@/lib/actions/clients";
import { Modal } from "@/components/ui/Modal";
import type { Dictionary } from "@/lib/dictionary";

const initialState: ContactFormState = {};

type T = Dictionary["clients"]["addContact"];

export function AddContactButton({ clientId, t }: { clientId: string; t: T }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btno text-[9px]">
        {t.newContactBtn}
      </button>
      {open && <AddContactModal clientId={clientId} onClose={() => setOpen(false)} t={t} />}
    </>
  );
}

function AddContactModal({ clientId, onClose, t }: { clientId: string; onClose: () => void; t: T }) {
  const [state, formAction, pending] = useActionState(addClientContactAction, initialState);

  useEffect(() => {
    if (state.success) onClose();
    // onClose unmounts this modal once called, so it can't double-fire — safe to omit from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <Modal title={t.modalTitle} onClose={onClose} closeLabel={t.cancel}>
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="clientId" value={clientId} />
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{t.nameLabel}</span>
          <input name="name" required autoFocus className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{t.roleLabel}</span>
          <input name="role" className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{t.phoneLabel}</span>
          <input name="phone" className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{t.emailLabel}</span>
          <input name="email" type="email" className="input" />
        </label>

        {state.error && <p className="text-sm text-warning">{state.error}</p>}

        <div className="flex gap-2 mt-1">
          <button type="submit" disabled={pending} className="btn">
            {pending ? t.adding : t.addContact}
          </button>
          <button type="button" onClick={onClose} className="btno">
            {t.cancel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
