"use client";

import { useActionState } from "react";
import { updateUserInfoAction, type SettingsFormState } from "@/lib/actions/settings";
import { CancelLink } from "@/components/ui/CancelLink";

const initialState: SettingsFormState = {};

export function EditUserForm({
  id,
  name,
  email,
  isCardHolder,
}: {
  id: string;
  name: string;
  email: string;
  isCardHolder: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateUserInfoAction, initialState);

  return (
    <form action={formAction} className="max-w-sm flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <label className="flex flex-col gap-1.5">
        <span className="heading-label">Name</span>
        <input name="name" defaultValue={name} required className="input" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="heading-label">Email</span>
        <input name="email" type="email" defaultValue={email} required className="input" />
      </label>
      <label className="flex items-center gap-1.5">
        <input name="isCardHolder" type="checkbox" defaultChecked={isCardHolder} />
        <span className="text-[12px]">Company card holder</span>
      </label>

      {state.error && <p className="text-sm text-accent">{state.error}</p>}

      <div className="flex gap-2 mt-1">
        <button type="submit" disabled={pending} className="btn">
          {pending ? "Saving…" : "Save changes"}
        </button>
        <CancelLink href="/settings" />
      </div>
    </form>
  );
}
