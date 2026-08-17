"use client";

import { useActionState, useTransition } from "react";
import {
  updateUserInfoAction,
  deactivateUserAction,
  reactivateUserAction,
  resetPasswordAction,
  type SettingsFormState,
} from "@/lib/actions/settings";
import { CancelLink } from "@/components/ui/CancelLink";
import { RoleSelect } from "./RoleSelect";

const initialState: SettingsFormState = {};

export function EditUserForm({
  id,
  name,
  email,
  isCardHolder,
  role,
  customRoleId,
  active,
  isSelf,
  customRoles,
}: {
  id: string;
  name: string;
  email: string;
  isCardHolder: boolean;
  role: string;
  customRoleId: string | null;
  active: boolean;
  isSelf: boolean;
  customRoles: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(updateUserInfoAction, initialState);
  const roleValue = customRoleId ? `CUSTOM:${customRoleId}` : `ROLE:${role}`;

  return (
    <div className="max-w-sm">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={id} />
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">Name</span>
          <input name="name" defaultValue={name} required className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">Email</span>
          <input name="email" type="email" defaultValue={email} required className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">Role</span>
          <RoleSelect name="role" defaultValue={roleValue} customRoles={customRoles} disabled={isSelf} className="input" />
          {isSelf && <span className="text-[9px] placeholder-text">You can&apos;t change your own role.</span>}
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

      <div className="rule-thin my-4" />
      <div className="label mb-1.5">Password</div>
      <ResetPasswordButton id={id} />

      {!isSelf && (
        <>
          <div className="rule-thin my-4" />
          <div className="label mb-1.5">{active ? "Deactivate" : "Reactivate"} account</div>
          {active ? <DeactivateButton id={id} /> : <ReactivateButton id={id} />}
        </>
      )}
    </div>
  );
}

function ResetPasswordButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initialState);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="btno">
        {pending ? "Generating…" : "Generate new one-time password"}
      </button>
      {state.success && <p className="text-sm mt-2 border border-ink/25 p-2 max-w-xs">{state.success}</p>}
    </form>
  );
}

// See ConfirmDeleteButton.tsx for why this is onClick + a direct action call
// rather than <form action> + onSubmit-preventDefault (that pattern raced).
function DeactivateButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <p className="text-[10px] placeholder-text mb-2 max-w-xs">
        They&apos;ll be signed out and won&apos;t be able to log back in. Past expenses, payments and time entries stay attributed to them.
      </p>
      <button
        type="button"
        disabled={pending}
        className="btno !border-accent text-accent"
        onClick={() => {
          if (!confirm("Deactivate this account? They won't be able to log in — including ending any session they have open right now — but their past records stay intact.")) {
            return;
          }
          const formData = new FormData();
          formData.set("id", id);
          startTransition(() => {
            deactivateUserAction(formData);
          });
        }}
      >
        {pending ? "Deactivating…" : "Deactivate account"}
      </button>
    </div>
  );
}

function ReactivateButton({ id }: { id: string }) {
  return (
    <form action={reactivateUserAction}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn">
        Reactivate account
      </button>
    </form>
  );
}
