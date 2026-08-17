"use client";

import { useActionState, useState } from "react";
import {
  createCustomRoleAction,
  updateCustomRoleAction,
  deleteCustomRoleAction,
  type SettingsFormState,
} from "@/lib/actions/settings";
import {
  EVENTS_ACCESS_LABEL,
  FINANCE_ACCESS_LABEL,
  EXPENSES_ACCESS_LABEL,
  SETTINGS_ACCESS_LABEL,
  EVENTS_ACCESS_OPTIONS,
  FINANCE_ACCESS_OPTIONS,
  EXPENSES_ACCESS_OPTIONS,
  SETTINGS_ACCESS_OPTIONS,
} from "@/lib/access-levels";
import type { EventsAccess, FinanceAccess, ExpensesAccess, SettingsAccess } from "@/generated/prisma/enums";

export type CustomRoleRow = {
  id: string;
  name: string;
  events: EventsAccess;
  finance: FinanceAccess;
  expenses: ExpensesAccess;
  settings: SettingsAccess;
  userCount: number;
};

const initialState: SettingsFormState = {};

export function RolesTab({ roles }: { roles: CustomRoleRow[] }) {
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <p className="text-[10px] placeholder-text mb-3 max-w-prose">
        Custom roles are additive — Admin, Accountant, Producer and Member stay exactly as they are. Use this when
        someone needs a reach none of those four quite match.
      </p>

      <div className="grid grid-cols-[1fr_1.3fr_1fr_1.3fr_1.3fr_auto] gap-2.5 border-b-2 border-ink pb-1.5">
        <span className="heading-label">Name</span>
        <span className="heading-label">Events</span>
        <span className="heading-label">Finance</span>
        <span className="heading-label">Expenses</span>
        <span className="heading-label">Settings</span>
        <span className="heading-label"></span>
      </div>

      {roles.length === 0 && !creating && <p className="text-sm placeholder-text mt-3">No custom roles yet.</p>}
      {roles.map((role) => (
        <RoleRow key={role.id} role={role} />
      ))}

      {creating ? (
        <RoleForm onDone={() => setCreating(false)} />
      ) : (
        <button type="button" onClick={() => setCreating(true)} className="btno mt-3 text-[9px]">
          New role
        </button>
      )}
    </div>
  );
}

function RoleRow({ role }: { role: CustomRoleRow }) {
  const [editing, setEditing] = useState(false);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCustomRoleAction, initialState);

  if (editing) return <RoleForm existing={role} onDone={() => setEditing(false)} />;

  return (
    <div className="grid grid-cols-[1fr_1.3fr_1fr_1.3fr_1.3fr_auto] gap-2.5 items-center py-2.5 border-b border-ink/13 text-[13px]">
      <div>
        {role.name} <span className="placeholder-text text-[10px]">· {role.userCount} account{role.userCount === 1 ? "" : "s"}</span>
      </div>
      <div className="placeholder-text text-[11px]">{EVENTS_ACCESS_LABEL[role.events]}</div>
      <div className="placeholder-text text-[11px]">{FINANCE_ACCESS_LABEL[role.finance]}</div>
      <div className="placeholder-text text-[11px]">{EXPENSES_ACCESS_LABEL[role.expenses]}</div>
      <div className="placeholder-text text-[11px]">{SETTINGS_ACCESS_LABEL[role.settings]}</div>
      <div className="flex gap-2 text-[9px] tracking-[0.1em] uppercase">
        <button type="button" onClick={() => setEditing(true)} className="placeholder-text hover:text-ink">
          Edit
        </button>
        <form
          action={deleteAction}
          onSubmit={(e) => {
            if (!confirm(`Delete the role "${role.name}"? This can't be undone.`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={role.id} />
          <button type="submit" disabled={deletePending} className="placeholder-text hover:text-accent">
            Delete
          </button>
        </form>
      </div>
      {deleteState.error && <div className="col-span-6 text-[11px] text-accent mt-1">{deleteState.error}</div>}
    </div>
  );
}

function RoleForm({ existing, onDone }: { existing?: CustomRoleRow; onDone: () => void }) {
  const action = existing ? updateCustomRoleAction : createCustomRoleAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="border border-ink/25 p-3 mt-2 flex flex-col gap-2.5 max-w-2xl">
      {existing && <input type="hidden" name="id" value={existing.id} />}
      <label className="flex flex-col gap-1">
        <span className="heading-label">Role name</span>
        <input name="name" defaultValue={existing?.name} required className="input max-w-xs" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <AccessField label="Events" name="events" options={EVENTS_ACCESS_OPTIONS} labels={EVENTS_ACCESS_LABEL} defaultValue={existing?.events ?? "NONE"} />
        <AccessField label="Finance (quotes/invoices)" name="finance" options={FINANCE_ACCESS_OPTIONS} labels={FINANCE_ACCESS_LABEL} defaultValue={existing?.finance ?? "NONE"} />
        <AccessField label="Expenses" name="expenses" options={EXPENSES_ACCESS_OPTIONS} labels={EXPENSES_ACCESS_LABEL} defaultValue={existing?.expenses ?? "NONE"} />
        <AccessField label="Settings" name="settings" options={SETTINGS_ACCESS_OPTIONS} labels={SETTINGS_ACCESS_LABEL} defaultValue={existing?.settings ?? "NONE"} />
      </div>

      {state.error && <p className="text-sm text-accent">{state.error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn">
          {pending ? "Saving…" : existing ? "Save role" : "Create role"}
        </button>
        <button type="button" onClick={onDone} className="btno">
          Cancel
        </button>
      </div>
    </form>
  );
}

function AccessField<T extends string>({
  label,
  name,
  options,
  labels,
  defaultValue,
}: {
  label: string;
  name: string;
  options: T[];
  labels: Record<T, string>;
  defaultValue: T;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="heading-label">{label}</span>
      <select name={name} defaultValue={defaultValue} className="input">
        {options.map((o) => (
          <option key={o} value={o}>
            {labels[o]}
          </option>
        ))}
      </select>
    </label>
  );
}
