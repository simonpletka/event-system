import { EVENTS_ACCESS_LABEL, FINANCE_ACCESS_LABEL, EXPENSES_ACCESS_LABEL, SETTINGS_ACCESS_LABEL } from "@/lib/access-levels";
import type { EventsAccess, FinanceAccess, ExpensesAccess, SettingsAccess } from "@/generated/prisma/enums";

const BUILT_IN_ROWS = [
  { role: "Admin", events: "all, full", finance: "full", expenses: "full", settings: "users, roles, company, template" },
  { role: "Accountant", events: "all, read", finance: "full", expenses: "full", settings: "company, invoice template" },
  { role: "Producer", events: "own / assigned, edit", finance: "read on own events", expenses: "add on own events", settings: "none" },
  { role: "Member", events: "assigned, read", finance: "none", expenses: "own expenses only", settings: "none" },
];

export function RoleReferenceTable({
  customRoles,
}: {
  customRoles?: { id: string; name: string; events: EventsAccess; finance: FinanceAccess; expenses: ExpensesAccess; settings: SettingsAccess }[];
}) {
  return (
    <div className="card px-3.5 py-3.5">
      <div className="heading-label mb-2">What each role can reach</div>
      <div className="grid grid-cols-[.9fr_1.1fr_1.1fr_1fr_1.2fr] gap-2.5 border-b border-ink/14 pb-1.5">
        <span className="heading-label">Role</span>
        <span className="heading-label">Events</span>
        <span className="heading-label">Quotes &amp; invoices</span>
        <span className="heading-label">Expenses</span>
        <span className="heading-label">Settings</span>
      </div>
      {BUILT_IN_ROWS.map((r) => (
        <div key={r.role} className="grid grid-cols-[.9fr_1.1fr_1.1fr_1fr_1.2fr] gap-2.5 py-2.5 border-b border-ink/8 text-[13px]">
          <div className="font-medium">{r.role}</div>
          <div className="placeholder-text">{r.events}</div>
          <div className="placeholder-text">{r.finance}</div>
          <div className="placeholder-text">{r.expenses}</div>
          <div className="placeholder-text">{r.settings}</div>
        </div>
      ))}
      {customRoles?.map((r) => (
        <div key={r.id} className="grid grid-cols-[.9fr_1.1fr_1.1fr_1fr_1.2fr] gap-2.5 py-2.5 border-b border-ink/8 last:border-b-0 text-[13px]">
          <div className="font-medium flex items-center gap-1.5">
            {r.name} <span className="tag tag-neutral">custom</span>
          </div>
          <div className="placeholder-text">{EVENTS_ACCESS_LABEL[r.events]}</div>
          <div className="placeholder-text">{FINANCE_ACCESS_LABEL[r.finance]}</div>
          <div className="placeholder-text">{EXPENSES_ACCESS_LABEL[r.expenses]}</div>
          <div className="placeholder-text">{SETTINGS_ACCESS_LABEL[r.settings]}</div>
        </div>
      ))}
      <div className="label mt-2.5">The card-holder flag decides who is offered in &quot;paid by&quot; on a new expense.</div>
    </div>
  );
}
