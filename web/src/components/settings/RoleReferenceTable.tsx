"use client";

import { useActionState, useState, startTransition } from "react";
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
import { useConfirmDialog } from "@/components/ui/ConfirmDialogProvider";
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

const GRID = "grid grid-cols-[.9fr_1.1fr_1.1fr_1fr_1.2fr_auto] gap-2.5";

const BUILT_IN_ROWS = [
  { role: "Admin", events: "all, full", finance: "full", expenses: "full", settings: "users, roles, company, template" },
  { role: "Accountant", events: "all, read", finance: "full", expenses: "full", settings: "company, invoice template" },
  { role: "Producer", events: "own / assigned, edit", finance: "read on own events", expenses: "add on own events", settings: "none" },
  { role: "Member", events: "assigned, read", finance: "none", expenses: "own expenses only", settings: "none" },
];

export function RoleReferenceTable({
  customRoles = [],
  canManage = false,
}: {
  customRoles?: CustomRoleRow[];
  canManage?: boolean;
}) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="card px-3.5 py-3.5">
      <div className="flex items-center justify-between mb-2">
        <div className="heading-label">What each role can reach</div>
        {canManage && !creating && (
          <button type="button" onClick={() => setCreating(true)} className="btno text-[9px]">
            + New role
          </button>
        )}
      </div>

      <div className={`${GRID} border-b border-ink/14 pb-1.5`}>
        <span className="heading-label">Role</span>
        <span className="heading-label">Events</span>
        <span className="heading-label">Quotes &amp; invoices</span>
        <span className="heading-label">Expenses</span>
        <span className="heading-label">Settings</span>
        <span className="heading-label"></span>
      </div>

      {BUILT_IN_ROWS.map((r) => (
        <div key={r.role} className={`${GRID} py-2.5 border-b border-ink/8 text-[13px]`}>
          <div className="font-medium">{r.role}</div>
          <div className="placeholder-text">{r.events}</div>
          <div className="placeholder-text">{r.finance}</div>
          <div className="placeholder-text">{r.expenses}</div>
          <div className="placeholder-text">{r.settings}</div>
          <div></div>
        </div>
      ))}

      {(customRoles.length > 0 || creating) && (
        <div className="pt-2.5 pb-1">
          <div className="heading-label">Custom roles</div>
        </div>
      )}

      {customRoles.map((role) => (
        <RoleRow key={role.id} role={role} canManage={canManage} />
      ))}

      {creating && <RoleForm onDone={() => setCreating(false)} />}
    </div>
  );
}

function RoleRow({ role, canManage }: { role: CustomRoleRow; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCustomRoleAction, initialState);
  const { confirm } = useConfirmDialog();

  if (editing) return <RoleForm existing={role} onDone={() => setEditing(false)} />;

  return (
    <div className={`${GRID} py-2.5 border-b border-ink/8 last:border-b-0 text-[13px] items-center`}>
      <div className="font-medium flex items-center gap-1.5">
        {role.name} <span className="tag tag-neutral">custom</span>
      </div>
      <div className="placeholder-text">{EVENTS_ACCESS_LABEL[role.events]}</div>
      <div className="placeholder-text">{FINANCE_ACCESS_LABEL[role.finance]}</div>
      <div className="placeholder-text">{EXPENSES_ACCESS_LABEL[role.expenses]}</div>
      <div className="placeholder-text">{SETTINGS_ACCESS_LABEL[role.settings]}</div>
      {canManage ? (
        <div className="flex gap-2 text-[9px] tracking-[0.1em] uppercase">
          <button type="button" onClick={() => setEditing(true)} className="placeholder-text hover:text-ink">
            Edit
          </button>
          <button
            type="button"
            disabled={deletePending}
            className="placeholder-text hover:text-warning"
            onClick={async () => {
              const ok = await confirm(`Delete the role "${role.name}"? This can't be undone.`, { confirmLabel: "Delete" });
              if (!ok) return;
              const formData = new FormData();
              formData.set("id", role.id);
              startTransition(() => deleteAction(formData));
            }}
          >
            Delete
          </button>
        </div>
      ) : (
        <div></div>
      )}
      {deleteState.error && <div className="col-span-6 text-[11px] text-warning mt-1">{deleteState.error}</div>}
    </div>
  );
}

function RoleForm({ existing, onDone }: { existing?: CustomRoleRow; onDone: () => void }) {
  const action = existing ? updateCustomRoleAction : createCustomRoleAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="card p-4 mt-2.5 flex flex-col gap-2.5 max-w-2xl">
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

      {state.error && <p className="text-sm text-warning">{state.error}</p>}

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
