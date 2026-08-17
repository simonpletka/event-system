const ROWS = [
  { role: "Admin", events: "all, full", finance: "full", expenses: "full", settings: "users, roles, company, template" },
  { role: "Accountant", events: "all, read", finance: "full", expenses: "full", settings: "company, invoice template" },
  { role: "Producer", events: "own / assigned, edit", finance: "read on own events", expenses: "add on own events", settings: "none" },
  { role: "Member", events: "assigned, read", finance: "none", expenses: "own expenses only", settings: "none" },
];

export function RoleReferenceTable() {
  return (
    <div>
      <div className="label mb-1">What each role can reach</div>
      <div className="grid grid-cols-[.9fr_1.1fr_1.1fr_1fr_1.2fr] gap-2.5 border-b-2 border-ink pb-1.5">
        <span className="heading-label">Role</span>
        <span className="heading-label">Events</span>
        <span className="heading-label">Quotes &amp; invoices</span>
        <span className="heading-label">Expenses</span>
        <span className="heading-label">Settings</span>
      </div>
      {ROWS.map((r) => (
        <div key={r.role} className="grid grid-cols-[.9fr_1.1fr_1.1fr_1fr_1.2fr] gap-2.5 py-2 border-b border-ink/10 text-[13px]">
          <div>{r.role}</div>
          <div className="placeholder-text">{r.events}</div>
          <div className="placeholder-text">{r.finance}</div>
          <div className="placeholder-text">{r.expenses}</div>
          <div className="placeholder-text">{r.settings}</div>
        </div>
      ))}
      <div className="label mt-2">The card-holder flag decides who is offered in &quot;paid by&quot; on a new expense.</div>
    </div>
  );
}
