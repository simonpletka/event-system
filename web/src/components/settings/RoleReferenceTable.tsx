"use client";

import { useActionState, useState, startTransition } from "react";
import {
  createCustomRoleAction,
  updateCustomRoleAction,
  deleteCustomRoleAction,
  type SettingsFormState,
} from "@/lib/actions/settings";
import { EVENTS_ACCESS_OPTIONS, FINANCE_ACCESS_OPTIONS, EXPENSES_ACCESS_OPTIONS, SETTINGS_ACCESS_OPTIONS } from "@/lib/access-levels";
import { useConfirmDialog } from "@/components/ui/ConfirmDialogProvider";
import type { EventsAccess, FinanceAccess, ExpensesAccess, SettingsAccess } from "@/generated/prisma/enums";
import { getDictionary, type Dictionary, type Locale } from "@/lib/dictionary";

export type CustomRoleRow = {
  id: string;
  name: string;
  events: EventsAccess;
  finance: FinanceAccess;
  expenses: ExpensesAccess;
  settings: SettingsAccess;
  userCount: number;
};

type T = Dictionary["settings"]["roles"];
type TAccess = Dictionary["accessLevels"];
type TRoles = Dictionary["roles"];

const initialState: SettingsFormState = {};

const GRID = "grid grid-cols-[.9fr_1.1fr_1.1fr_1fr_1.2fr_auto] gap-2.5";

export function RoleReferenceTable({
  customRoles = [],
  canManage = false,
  locale,
  tAccess,
  tRoles,
}: {
  customRoles?: CustomRoleRow[];
  canManage?: boolean;
  locale: Locale;
  tAccess: TAccess;
  tRoles: TRoles;
}) {
  const [creating, setCreating] = useState(false);
  const t = getDictionary(locale).settings.roles;

  const builtInRows = [
    { role: tRoles.ADMIN, events: t.builtIn.adminEvents, finance: t.builtIn.full, expenses: t.builtIn.full, settings: t.builtIn.adminSettings },
    { role: tRoles.ACCOUNTANT, events: t.builtIn.accountantEvents, finance: t.builtIn.full, expenses: t.builtIn.full, settings: t.builtIn.accountantSettings },
    { role: tRoles.PRODUCER, events: t.builtIn.producerEvents, finance: t.builtIn.producerFinance, expenses: t.builtIn.producerExpenses, settings: t.builtIn.none },
    { role: tRoles.MEMBER, events: t.builtIn.memberEvents, finance: t.builtIn.none, expenses: t.builtIn.memberExpenses, settings: t.builtIn.none },
  ];

  return (
    <div className="card px-3.5 py-3.5">
      <div className="flex items-center justify-between mb-2">
        <div className="heading-label !text-[12px]">{t.whatEachRoleCanReach}</div>
        {canManage && !creating && (
          <button type="button" onClick={() => setCreating(true)} className="btno text-[9px]">
            {t.newRoleBtn}
          </button>
        )}
      </div>

      <div className={`hidden md:grid ${GRID} border-b border-ink/14 pb-1.5 [&_.heading-label]:font-bold [&_.heading-label]:!text-[9px]`}>
        <span className="heading-label">{t.colRole}</span>
        <span className="heading-label">{t.colEvents}</span>
        <span className="heading-label">{t.colQuotesInvoices}</span>
        <span className="heading-label">{t.colExpenses}</span>
        <span className="heading-label">{t.colSettings}</span>
        <span className="heading-label"></span>
      </div>

      {builtInRows.map((r) => (
        <div key={r.role} className={`hidden md:grid ${GRID} py-3 border-b border-ink/8 text-[13px]`}>
          <div className="font-medium">{r.role}</div>
          <div className="placeholder-text">{r.events}</div>
          <div className="placeholder-text">{r.finance}</div>
          <div className="placeholder-text">{r.expenses}</div>
          <div className="placeholder-text">{r.settings}</div>
          <div></div>
        </div>
      ))}

      {builtInRows.map((r) => (
        <div key={`m-${r.role}`} className="md:hidden py-2.5 border-b border-ink/8 text-[13px]">
          <div className="font-medium mb-1">{r.role}</div>
          <div className="placeholder-text text-[11.5px] leading-relaxed">
            {t.colEvents}: {r.events} · {t.colQuotesInvoices}: {r.finance}
            <br />
            {t.colExpenses}: {r.expenses} · {t.colSettings}: {r.settings}
          </div>
        </div>
      ))}

      {(customRoles.length > 0 || creating) && (
        <div className="pt-2.5 pb-1">
          <div className="heading-label !text-[12px]">{t.customRolesHeading}</div>
        </div>
      )}

      {customRoles.map((role) => (
        <RoleRow key={role.id} role={role} canManage={canManage} t={t} tAccess={tAccess} />
      ))}

      {creating && <RoleForm onDone={() => setCreating(false)} t={t} tAccess={tAccess} />}
    </div>
  );
}

function RoleRow({ role, canManage, t, tAccess }: { role: CustomRoleRow; canManage: boolean; t: T; tAccess: TAccess }) {
  const [editing, setEditing] = useState(false);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCustomRoleAction, initialState);
  const { confirm } = useConfirmDialog();

  if (editing) return <RoleForm existing={role} onDone={() => setEditing(false)} t={t} tAccess={tAccess} />;

  const doDelete = async () => {
    const ok = await confirm(t.confirmDelete(role.name), { confirmLabel: t.delete });
    if (!ok) return;
    const formData = new FormData();
    formData.set("id", role.id);
    startTransition(() => deleteAction(formData));
  };

  return (
    <>
      <div className={`hidden md:grid ${GRID} py-3 border-b border-ink/8 last:border-b-0 text-[13px] items-center`}>
        <div className="font-medium flex items-center gap-1.5">
          {role.name} <span className="tag tag-neutral">{t.customTag}</span>
        </div>
        <div className="placeholder-text">{tAccess.events[role.events]}</div>
        <div className="placeholder-text">{tAccess.finance[role.finance]}</div>
        <div className="placeholder-text">{tAccess.expenses[role.expenses]}</div>
        <div className="placeholder-text">{tAccess.settings[role.settings]}</div>
        {canManage ? (
          <div className="flex gap-2 text-[9px] tracking-[0.1em] uppercase">
            <button type="button" onClick={() => setEditing(true)} className="placeholder-text hover:text-ink">
              {t.edit}
            </button>
            <button type="button" disabled={deletePending} className="placeholder-text hover:text-warning" onClick={doDelete}>
              {t.delete}
            </button>
          </div>
        ) : (
          <div></div>
        )}
        {deleteState.error && <div className="col-span-6 text-[11px] text-warning mt-1">{deleteState.error}</div>}
      </div>

      <div className="md:hidden py-2.5 border-b border-ink/8 last:border-b-0 text-[13px]">
        <div className="font-medium flex items-center gap-1.5 mb-1">
          {role.name} <span className="tag tag-neutral">{t.customTag}</span>
        </div>
        <div className="placeholder-text text-[11.5px] leading-relaxed">
          {t.colEvents}: {tAccess.events[role.events]} · {t.colQuotesInvoices}: {tAccess.finance[role.finance]}
          <br />
          {t.colExpenses}: {tAccess.expenses[role.expenses]} · {t.colSettings}: {tAccess.settings[role.settings]}
        </div>
        {canManage && (
          <div className="flex gap-2.5 text-[9px] tracking-[0.1em] uppercase mt-2">
            <button type="button" onClick={() => setEditing(true)} className="placeholder-text hover:text-ink">
              {t.edit}
            </button>
            <button type="button" disabled={deletePending} className="placeholder-text hover:text-warning" onClick={doDelete}>
              {t.delete}
            </button>
          </div>
        )}
        {deleteState.error && <div className="text-[11px] text-warning mt-2">{deleteState.error}</div>}
      </div>
    </>
  );
}

function RoleForm({ existing, onDone, t, tAccess }: { existing?: CustomRoleRow; onDone: () => void; t: T; tAccess: TAccess }) {
  const action = existing ? updateCustomRoleAction : createCustomRoleAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="card p-4 mt-2.5 flex flex-col gap-2.5 max-w-2xl">
      {existing && <input type="hidden" name="id" value={existing.id} />}
      <label className="flex flex-col gap-1">
        <span className="heading-label">{t.roleNameLabel}</span>
        <input name="name" defaultValue={existing?.name} required className="input max-w-xs" />
      </label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <AccessField label={t.eventsFieldLabel} name="events" options={EVENTS_ACCESS_OPTIONS} labels={tAccess.events} defaultValue={existing?.events ?? "NONE"} />
        <AccessField label={t.financeFieldLabel} name="finance" options={FINANCE_ACCESS_OPTIONS} labels={tAccess.finance} defaultValue={existing?.finance ?? "NONE"} />
        <AccessField label={t.expensesFieldLabel} name="expenses" options={EXPENSES_ACCESS_OPTIONS} labels={tAccess.expenses} defaultValue={existing?.expenses ?? "NONE"} />
        <AccessField label={t.settingsFieldLabel} name="settings" options={SETTINGS_ACCESS_OPTIONS} labels={tAccess.settings} defaultValue={existing?.settings ?? "NONE"} />
      </div>

      {state.error && <p className="text-sm text-warning">{state.error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn">
          {pending ? t.saving : existing ? t.saveRole : t.createRole}
        </button>
        <button type="button" onClick={onDone} className="btno">
          {t.cancel}
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
