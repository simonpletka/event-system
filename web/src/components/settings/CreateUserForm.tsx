"use client";

import { useActionState } from "react";
import { createUserAction, type SettingsFormState } from "@/lib/actions/settings";
import { RoleSelect } from "./RoleSelect";
import { getDictionary, type Dictionary, type Locale } from "@/lib/dictionary";

const initialState: SettingsFormState = {};

type TRoles = Dictionary["roles"];
type TRoleSelect = Dictionary["settings"]["roleSelect"];

export function CreateUserForm({
  customRoles,
  locale,
  tRoles,
  tRoleSelect,
}: {
  customRoles: { id: string; name: string }[];
  locale: Locale;
  tRoles: TRoles;
  tRoleSelect: TRoleSelect;
}) {
  const [state, formAction, pending] = useActionState(createUserAction, initialState);
  const t = getDictionary(locale).settings.users;

  return (
    <div className="card px-5 py-4">
      <div className="heading-label mb-2.5">{t.newAccountHeading}</div>
      <form action={formAction} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_150px_100px_auto] gap-2.5 items-end">
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">{t.nameLabel}</span>
          <input name="name" required className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">{t.emailLabel}</span>
          <input name="email" type="email" required className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">{t.roleLabel}</span>
          <RoleSelect name="role" defaultValue="ROLE:MEMBER" customRoles={customRoles} className="input" t={tRoleSelect} tRoles={tRoles} />
        </label>
        <label className="flex items-center gap-1.5 pb-2.5">
          <input name="isCardHolder" type="checkbox" />
          <span className="text-[10px]">{t.companyCardLabel}</span>
        </label>
        <button type="submit" disabled={pending} className="btn">
          {pending ? t.creating : t.createAccount}
        </button>
      </form>
      {state.error && <p className="text-sm text-warning mt-2">{state.error}</p>}
      {state.success && <p className="text-sm mt-2 border border-ink/25 rounded-lg p-2.5 max-w-lg">{state.success}</p>}
    </div>
  );
}
