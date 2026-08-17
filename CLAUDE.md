# Event system — working notes

Internal web app for an event agency: events from inquiry to invoicing, finance (quotes/invoices/expenses/reports), time tracking. Source of truth for requirements: `docs/system_info/event-system-zadani.pdf` (Czech brief, 17 Aug 2026). Visual/UX source of truth: `docs/wireframes/` (see `docs/wireframes/README.md` for the screen index and decisions already made there — don't re-derive those, they're settled).

Build plan for the current phase lives at `/Users/simonpletka/.claude/plans/tingly-popping-hippo.md`.

## Status

**Phase 1 (done):** project foundation, design system, auth, Dashboard, Events (list + tabbed detail with working Milestones CRUD + create/edit).

**Phase 2 (done):** Finance module — Quotes (`4a`, line items, one-click convert to invoice), Invoices (`4b` list with KPI strip, `4c` detail with a real generated PDF + embedded Czech "QR Platba" code, payment recording, mark-as-paid, action history), Expenses (list + `4d` new-expense form with receipt upload incl. mobile camera capture, "company overhead" no-event option), Reports (`4e`, by event/month/category, CSV export, print). Full RBAC matrix per brief §2.2. Verified via `npm run build` + `npm run lint` (both clean) plus extensive HTTP smoke tests: full quote→invoice conversion pipeline, PDF generation (confirmed valid PDF bytes with embedded QR image), partial payment → mark-as-paid state transitions, receipt upload + authenticated retrieval (confirmed byte-identical + confirmed a different user correctly gets 404), both CSV exports, and role scoping for all four roles. **No browser tool was available in either phase's session**, so nothing has been visually checked in an actual browser yet — do that before trusting the visual polish, especially the PDF layout and the drag-and-drop receipt input.

Dev login (seeded by `prisma/seed.ts`, password `changeme123` for all): `admin@eventsystem.cz`, `eva.kucerova@eventsystem.cz` (Accountant), `jan.novak@eventsystem.cz` (Producer), `m.dvorak@eventsystem.cz` (Member). **Re-login after every `prisma db seed`** — seeding wipes and recreates all rows with new IDs, so old session cookies/JWTs silently point at users/events that no longer exist (cost real debugging time once already — the symptom is empty lists with no error).

**Deferred to later phases (not built yet):** Time tracker (start/stop, manual entry, comparisons), Settings screens (users & roles, company data editing, invoice template editing), Google Calendar sync, Google OAuth login, ARES lookup, notifications/reminder emails, general audit log (beyond the invoice-specific action log), events calendar week view (`3e`), PWA offline queue, expense approval workflow (the field and hint text exist, nothing enforces it). Dashboard/Time-tracker nav still lands on a "coming soon" placeholder; Finance is now fully live.

## Environment

This machine had **no Node.js, npm, Homebrew, Docker, or working Postgres** when the project started (MacPorts is present but broken — OS/platform mismatch). Network access works.

- **Node.js** (v24.19.0 LTS) is installed user-local at `~/.local/node-v24.19.0-darwin-arm64`, symlinked into `~/.local/bin` (already on `PATH`). No sudo, no Homebrew. If a fresh shell can't find `node`/`npm`, check `~/.local/bin` is on `PATH`.
- **Database**: SQLite via Prisma for local dev (`web/prisma/dev.db`, gitignored). No separate DB service to run. Swapping to Postgres later means changing the Prisma datasource + running a migration — not a rewrite.
- **Git**: the *entire home directory* (`/Users/simonpletka`) is already a separate, commit-less git repo. Don't touch it. This project has its **own** nested repo at `PRODUCTION_APP/.git`, initialized separately — that's the one to use for all commits here.

## Tech stack

- Next.js **16.3.1** (App Router, TypeScript, RSC, Turbopack by default), project lives in `web/`. This is newer than most training data — `web/AGENTS.md` (auto-written by `next dev`) points at the bundled docs in `web/node_modules/next/dist/docs/`; read the relevant guide there before assuming Next 15-era APIs. Concretely: `params`/`searchParams` in pages are `Promise`s (must `await`), `middleware.ts` is renamed to `proxy.ts` (not used in this project — auth is checked per-layout/per-server-action instead, which is Next's own current recommendation), and parallel-route slots need a `default.js`.
- Prisma **7.9.1** — also a major-version jump from most training data. Breaking changes that bit during setup: `datasource.url` can no longer live in `schema.prisma` (goes in `prisma.config.ts` instead), SQL providers require an explicit driver adapter package (`@prisma/adapter-better-sqlite3` + `better-sqlite3` here), and the generated client lives wherever `generator client { output = ... }` points (`web/src/generated/prisma`, gitignored, import via `@/generated/prisma/client` and `@/generated/prisma/enums`) instead of `node_modules`. `prisma init` vendors a `.claude/skills/prisma-*` directory into the project with detailed migration guides — check there before fighting a Prisma error that looks version-related.
- SQLite (dev), via the adapter above
- NextAuth (Auth.js), Credentials provider only for now — bcrypt-hashed passwords, accounts are admin-seeded, no self-registration (per brief §2.1). Google OAuth provider to be added later purely via env vars once the user supplies Google Cloud credentials.
- Tailwind CSS v4, theme tokens taken directly from the wireframes (dark theme):
  - background `#131211`, surface `#1a1918`, text/border `#f3f2f2`, accent `#ec3013`
  - accent red is reserved for attention/primary actions only — not decorative
  - Archivo font, 2px rules on primary dividers / 1px on secondary, 0 border-radius everywhere
- `npm install` blocks postinstall scripts by default (npm 11's allow-scripts). When adding a new dependency that needs a postinstall (prisma, esbuild, native modules, etc.), run `npm approve-scripts <pkg>` after install or it silently won't work.
- `@react-pdf/renderer` (server-side invoice PDF generation, `src/lib/pdf/InvoicePdf.tsx`, rendered via `renderToBuffer` in a route handler — not part of the app's own React tree, so no version-conflict risk) + `qrcode` (renders the Czech "QR Platba" payment string to a PNG data URL for the PDF).
- Uploaded expense receipts are stored on local disk at `web/uploads/receipts/` (gitignored, **not** under `public/`) and served only through an authenticated route handler (`src/app/api/uploads/receipts/[filename]/route.ts`) that checks the requesting user actually has access to the expense the receipt belongs to. Won't survive a redeploy to a stateless host — fine for local dev, would need object storage (S3-alike) before shipping anywhere else.
- ESLint's `react-hooks/purity` rule flags `Date.now()` (but not `new Date()`) as an impure call inside a component body — write `new Date().getTime()` instead if a component needs "now".

## Data model decisions

- `EventStatus` enum has the brief's 6 states **plus `CANCELLED`** — brief §4.3 explicitly invites adding a cancelled state ("klidně doplníme další stav, např. 'Zrušeno'"); added now since it's cheap pre-launch and painful to migrate later.
- Event detail layout: built as **3c (tabbed)**, not 3d (single-scroll) — user's explicit choice between the two wireframe options the brief left open.
- `TimeEntry` still exists only as a Phase 1 stub (Event-detail relation counts need it); `Quote`/`Invoice`/`Expense` are now the real Phase 2 tables.
- **Invoice numbering**: per-year sequences — quotes `YYYY-Q##` (unpadded), invoices `YYYY-####` (4-digit padded), computed at creation time from a count of that year's existing documents (`src/lib/document-number.ts`). Not safe under heavy concurrent writes (no locking), fine for this app's actual write volume.
- **`InvoiceStatus` has no stored `OVERDUE` value** — deliberately. It's `ISSUED | PARTLY_PAID | PAID` only; "overdue" is derived everywhere as `dueDate < now && status !== PAID` (`isOverdue()` in `src/lib/queries/finance.ts`, and inline in `StatusPill.tsx`). Storing it would go stale without a cron job.
- **VAT**: `CompanySettings.isVatPayer` flag + a per-line-item `vatRate` (defaults 21%, the standard CZ rate) — the business decision is data, not code. No editing UI for `CompanySettings` yet (Settings, Phase 4) — seeded directly with a real IBAN so the QR code has something to encode.
- **"Paid by" on an expense**: defaults to the current user. A non-card-holder can only submit as themselves; a card holder (or Admin/Accountant/Producer) gets a dropdown of all card holders plus themselves. This reconciles brief §5.3 (paid-by limited to card holders) with §2.2 (a Member can add their own expense) — it's a judgment call, not a direct spec quote.
- **Company overhead**: `Expense.eventId` is nullable rather than a fake pseudo-Event row; the new-expense form's event picker has an explicit "Company overhead — not tied to an event" option.
- **Invoice "History" panel** (`4c`) is a small, targeted `InvoiceEvent` action log (created/issued/payment-recorded/marked-paid), not a general audit log — that's still out of scope.

## Open questions from the brief (still open, will shape later phases)

From brief §8 — chapter 8 in the PDF has more detail on each. Resolved by Phase 2 (see above): invoice numbering, VAT handling, partial payments, company overhead. Still open:
- Event budget vs. actual tracking (beyond the simple quoted-value-vs-expenses shown on the event overview).
- Expense approval workflow — the `approved` field and UI hint text exist, nothing enforces it yet.
- Notifications (email/Slack) for milestones, due invoices, expense approvals — no email system exists; "Send by mail" and reminder-email copy in the UI are inert/labelled as such.
- General audit log for edits (not just invoice actions).
- Time tracker → invoicing (hourly rate → invoice line item); time is still internal-only stats.

## Commands (from `web/`)

- `npm run dev` — dev server
- `npm run build` / `npm run lint` — typecheck + build / lint
- `npx prisma migrate dev` — apply schema changes locally
- `npx prisma db seed` — wipes and reseeds demo data (`prisma/seed.ts`)
