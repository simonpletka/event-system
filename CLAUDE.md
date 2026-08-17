# Event system — working notes

Internal web app for an event agency: events from inquiry to invoicing, finance (quotes/invoices/expenses/reports), time tracking. Source of truth for requirements: `docs/system_info/event-system-zadani.pdf` (Czech brief, 17 Aug 2026). Visual/UX source of truth: `docs/wireframes/` (see `docs/wireframes/README.md` for the screen index and decisions already made there — don't re-derive those, they're settled).

Build plan for the current phase lives at `/Users/simonpletka/.claude/plans/tingly-popping-hippo.md`.

## Status

**Phase 1 (done):** project foundation, design system, auth, Dashboard, Events (list + tabbed detail with working Milestones CRUD + read-only Expenses/Time/Quotes&Invoices/Files tabs + create/edit). Verified via `npm run build` (clean type-check) + `npm run lint` (clean) + direct HTTP smoke tests of login, role-scoped event visibility (Admin/Accountant see all, Producer/Member see own/assigned), event detail rendering, and the milestone add/delete server actions — no browser tool was available in that session, so nothing was checked visually in an actual browser yet. Worth doing before trusting the visual polish.

Dev login (seeded by `prisma/seed.ts`, password `changeme123` for all): `admin@eventsystem.cz`, `eva.kucerova@eventsystem.cz` (Accountant), `jan.novak@eventsystem.cz` (Producer), `m.dvorak@eventsystem.cz` (Member).

**Deferred to later phases (not built yet):** Finance module (quotes/invoices/expenses/reports, PDF generation), Time tracker (start/stop, manual entry, comparisons), Settings screens (users & roles, company data, invoice template), Google Calendar sync, Google OAuth login, ARES lookup, notifications, audit log, events calendar week view (`3e`), PWA/mobile capture. See the plan file for the full list and reasoning. Dashboard/Events nav items for Finance and Time tracker currently land on "coming soon" placeholders.

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

## Data model decisions

- `EventStatus` enum has the brief's 6 states **plus `CANCELLED`** — brief §4.3 explicitly invites adding a cancelled state ("klidně doplníme další stav, např. 'Zrušeno'"); added now since it's cheap pre-launch and painful to migrate later.
- Event detail layout: built as **3c (tabbed)**, not 3d (single-scroll) — user's explicit choice between the two wireframe options the brief left open.
- Finance/Time-tracker tables (`Expense`, `TimeEntry`, `Quote`, `Invoice`) exist in the schema now as minimal stubs so Event-detail relation counts are real data, not fake placeholders — full CRUD/UI for them lands in later phases.

## Open questions from the brief (not blocking, but will shape later phases)

From brief §8 — chapter 8 in the PDF has more detail on each:
- Invoice numbering: one sequence or split by year?
- VAT payer status / manual VAT rate per line item?
- Invoice payment states: partial payments tracked separately?
- Expense approval workflow, or expenses count immediately?
- Event budget vs. actual tracking?
- Notifications (email/Slack) for milestones, due invoices, expense approvals?
- Audit log for financial record edits?
- Company overhead as a pseudo-event?
- Time tracker → invoicing (hourly rate → invoice line item), currently time is internal-only stats.

## Commands (from `web/`)

- `npm run dev` — dev server
- `npm run build` / `npm run lint` — typecheck + build / lint
- `npx prisma migrate dev` — apply schema changes locally
- `npx prisma db seed` — wipes and reseeds demo data (`prisma/seed.ts`)
