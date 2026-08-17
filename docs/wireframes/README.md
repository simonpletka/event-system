# Event system — wireframe documentation

Internal web application for an event agency: events from inquiry to invoicing, plus the full financial agenda (quotes, invoices, expenses, reports) and time tracking. Source brief: `uploads/event-system-zadani.pdf` (working version, 17 Aug 2026).

## Files

| File | What it is |
| --- | --- |
| `Event System Wireframes Final.dc.html` | Approved wireframes only, in reading order (dashboard → events → finance → time/settings) |
| `Event System Wireframes.dc.html` | Working canvas — all rounds including the three rejected first directions |
| `Event System Wireframes light.dc.html` | The same working canvas before the dark-mode switch |

Screens carry stable badges (`2a`, `3a`, `3e`, …). Use them in review comments.

## Decisions made

- **Direction:** grid/card dashboard (`1b` → refined as `2a`). The ledger-only and timeline-first directions were dropped.
- **Navigation:** left sidebar, collapsible («) so a wide table or calendar can use the full screen. Settings pinned at the bottom, above the signed-in user.
- **Roles are not shown in the UI** — permissions stay backend information.
- **Dashboard:** view switcher (list / timeline / calendar) with ← → and a **Today** button.
- **Event list:** sorted by date, nearest first, with the sort stated under the table; **Today** button to return after navigating.
- **Status board (kanban) was rejected** and replaced by a **calendar week view** (`3e`), which shows overlapping events side by side and multi-day events as bars in an all-day band.
- **Venues link out to Google Maps** on the event detail.
- **Theme:** dark, Modernist type and 2px rules, red used only for attention (overdue, needs action) and primary actions.
- Copy is in English; fidelity is low but with realistic labels and data.

## Screens

**01 Dashboard — `2a`**
Needs-attention cells (overdue invoices, waiting quotes, events to invoice), upcoming event cards with next milestone, latest expenses, monthly income/expense bars. Running timer lives in the sidebar.

**02 Events**
- `3a` List — table with status/date/client/place filters, search, Today, date sort, next-milestone line per row.
- `3e` Calendar week — all-day band for multi-day events (prep/build vs event days), timed grid with overlaps split across the column, legend, month/table switch.
- `3c` Detail, tabbed — Overview / Milestones / Expenses / Time / Quotes & invoices / Files, with a right rail for budget vs actual, time logged, documents and team.
- `3d` Detail, single scroll — same content as stacked blocks with a KPI strip; in-page nav in the sidebar.
  *Open:* pick one of `3c` / `3d`.

Detail content in both: brief, build/event/strike dates, multiple venues with map links, client contact plus company data (ARES), status, milestones synced to Google Calendar, expense and time summaries, linked quotes and invoices.

**03 Finance** — four tabs: Quotes, Invoices, Expenses, Reports.
- `4a` Quotes — number, event, client, issue/validity, total, status; accepted quotes convert to an invoice in one click, carrying items and client data.
- `4b` Invoices — KPI strip (unpaid, overdue, due in 7 days, paid this month), sorted by due date, payment states including partly paid; export for accounting.
- `4c` Invoice detail — PDF preview from the company template (supplier/customer, items, VAT, variable symbol, QR), payment state with progress and reminder date, links back to event, quote and the event's expenses, and an audit history.
- `4d` New expense — receipt drag-and-drop plus mobile camera capture, amount, date, paid-by limited to company-card holders, event autocomplete (including "company overhead"), category autocomplete from the fixed list, note, approval hint, offline queue on mobile.
- `4e` Reports — income / expenses / balance / margin, switchable by event, month or category, with a breakdown table and top expense categories.

**04 Time tracker, access & settings**
- `5a` Login — Google OAuth or issued credentials; no public registration.
- `5b` Time tracker — one running timer with editable description, manual entry with the same data structure, own history by day/week/month, weekly totals per event.
- `5c` Compare events — multi-select events, totals and cost per hour, hours by phase, per-person matrix; visibility follows role.
- `5d` Settings, users & roles — accounts, role per user, company-card flag (drives "paid by"), pending invitations, and a role/permission reference table.
- `5e` Settings, company & invoice template — company data with ARES lookup, VAT payer flag, bank details, numbering series and due days, invoice template preview, connected Google Workspace / calendar / ARES.

## Not yet designed

Notifications, expense approval flow, budget vs actual editing, audit log view, bulk export screens, full mobile beyond expense capture, and the calendar month view. Open questions from chapter 8 of the brief (VAT handling, numbering, partial payments, overhead as pseudo-event, time → invoicing) are reflected in the wireframes only where a field was needed.
