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
import { useConfirmDialog } from "@/components/ui/ConfirmDialogProvider";
import { RoleSelect } from "./RoleSelect";
import type { Dictionary } from "@/lib/dictionary";

const initialState: SettingsFormState = {};

type T = Dictionary["settings"]["editUser"];
type TRoles = Dictionary["roles"];
type TRoleSelect = Dictionary["settings"]["roleSelect"];
type TCommon = Dictionary["common"];

export function EditUserForm({
  id,
  name,
  email,
  phone,
  isCardHolder,
  role,
  customRoleId,
  active,
  isSelf,
  customRoles,
  t,
  tRoles,
  tRoleSelect,
  tCommon,
}: {
  id: string;
  name: string;
  email: string;
  phone: string;
  isCardHolder: boolean;
  role: string;
  customRoleId: string | null;
  active: boolean;
  isSelf: boolean;
  customRoles: { id: string; name: string }[];
  t: T;
  tRoles: TRoles;
  tRoleSelect: TRoleSelect;
  tCommon: TCommon;
}) {
  const [state, formAction, pending] = useActionState(updateUserInfoAction, initialState);
  const roleValue = customRoleId ? `CUSTOM:${customRoleId}` : `ROLE:${role}`;

  return (
    <div className="max-w-sm">
      <form action={formAction} className="card p-5 flex flex-col gap-3">
        <input type="hidden" name="id" value={id} />
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{t.nameLabel}</span>
          <input name="name" defaultValue={name} required className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{t.emailLabel}</span>
          <input name="email" type="email" defaultValue={email} required className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{t.phoneLabel}</span>
          <input name="phone" type="tel" defaultValue={phone} className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{t.roleLabel}</span>
          <RoleSelect name="role" defaultValue={roleValue} customRoles={customRoles} disabled={isSelf} className="input" t={tRoleSelect} tRoles={tRoles} />
          {isSelf && <span className="text-[9px] placeholder-text">{t.cantChangeOwnRole}</span>}
        </label>
        <label className="flex items-center gap-1.5">
          <input name="isCardHolder" type="checkbox" defaultChecked={isCardHolder} />
          <span className="text-[12px]">{t.companyCardHolderLabel}</span>
        </label>

        {state.error && <p className="text-sm text-warning">{state.error}</p>}

        <div className="flex gap-2 mt-1">
          <button type="submit" disabled={pending} className="btn">
            {pending ? t.saving : t.saveChanges}
          </button>
          <CancelLink href="/settings" label={tCommon.cancel} />
        </div>
      </form>

      <div className="rule-thin my-4" />
      <div className="label mb-1.5">{t.passwordLabel}</div>
      <ResetPasswordButton id={id} t={t} />

      {!isSelf && (
        <>
          <div className="rule-thin my-4" />
          <div className="label mb-1.5">{active ? t.deactivateHeading : t.reactivateHeading}</div>
          {active ? <DeactivateButton id={id} t={t} /> : <ReactivateButton id={id} t={t} />}
        </>
      )}
    </div>
  );
}

function ResetPasswordButton({ id, t }: { id: string; t: T }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initialState);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="btno">
        {pending ? t.generating : t.generateNewPassword}
      </button>
      {state.success && <p className="text-sm text-positive font-bold mt-2 border border-ink/25 p-2 max-w-xs">{state.success}</p>}
    </form>
  );
}

// See ConfirmDeleteButton.tsx for why this is onClick + a direct action call
// rather than <form action> + onSubmit-preventDefault (that pattern raced).
function DeactivateButton({ id, t }: { id: string; t: T }) {
  const [pending, startTransition] = useTransition();
  const { confirm } = useConfirmDialog();

  return (
    <div>
      <p className="text-[10px] placeholder-text mb-2 max-w-xs">{t.deactivateExplainer}</p>
      <button
        type="button"
        disabled={pending}
        className="btno !border-warning text-warning"
        onClick={async () => {
          const ok = await confirm(t.confirmDeactivate, { confirmLabel: t.deactivateLabel });
          if (!ok) return;
          const formData = new FormData();
          formData.set("id", id);
          startTransition(() => {
            deactivateUserAction(formData);
          });
        }}
      >
        {pending ? t.deactivating : t.deactivateBtn}
      </button>
    </div>
  );
}

function ReactivateButton({ id, t }: { id: string; t: T }) {
  return (
    <form action={reactivateUserAction}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn">
        {t.reactivateBtn}
      </button>
    </form>
  );
}
