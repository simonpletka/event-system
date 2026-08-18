"use client";

import { useActionState } from "react";
import { createUserAction, type SettingsFormState } from "@/lib/actions/settings";
import { RoleSelect } from "./RoleSelect";

const initialState: SettingsFormState = {};

export function CreateUserForm({ customRoles }: { customRoles: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(createUserAction, initialState);

  return (
    <div>
      <div className="label mb-1.5">New account — issued credentials, no self sign-up</div>
      <form action={formAction} className="grid grid-cols-[1fr_1fr_150px_100px_auto] gap-2 items-end">
        <label className="flex flex-col gap-1">
          <span className="heading-label">Name</span>
          <input name="name" required className="input" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="heading-label">Email</span>
          <input name="email" type="email" required className="input" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="heading-label">Role</span>
          <RoleSelect name="role" defaultValue="ROLE:MEMBER" customRoles={customRoles} className="input" />
        </label>
        <label className="flex items-center gap-1.5 pb-2">
          <input name="isCardHolder" type="checkbox" />
          <span className="text-[10px]">Company card</span>
        </label>
        <button type="submit" disabled={pending} className="btn">
          {pending ? "Creating…" : "Create account"}
        </button>
      </form>
      {state.error && <p className="text-sm text-warning mt-2">{state.error}</p>}
      {state.success && <p className="text-sm mt-2 border border-ink/25 p-2 max-w-lg">{state.success}</p>}
    </div>
  );
}
