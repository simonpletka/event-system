# Event System

An internal web app for an event agency: events from inquiry to invoicing,
finance (quotes, invoices, expenses, reports), and time tracking. Built for
one company's own internal use, not a general-purpose product.

Source of truth for requirements is the Czech brief in
`docs/system_info/event-system-zadani.pdf`; visual/UX decisions live in
`docs/wireframes/`. Day-to-day build notes, architecture decisions, and a
running history of what's been built are all in `CLAUDE.md` at the repo
root.

## Repository structure

- **`web/`** — the actual application. Next.js (App Router) + TypeScript +
  Prisma/SQLite + NextAuth. This is what's deployed and what everyone
  actually uses day to day.
- **`docs/`** — the original brief, wireframes, and reference material the
  app was built against.
- **`ios-app/`** — a native iOS wrapper (Capacitor) around the live web
  app. **Experimental, and development on it has been stopped.** It was a
  thin `WKWebView` shell pointed at the hosted site rather than a real
  native app — see `ios-app/README.md` for how it was set up if picking it
  back up later. Nothing in `web/` depends on it, and none of its own
  history counts against the main app's status below.

## Tech stack (web/)

- Next.js (App Router, TypeScript, React Server Components)
- Prisma + SQLite (dev) — driver-adapter based, migrations in
  `web/prisma/migrations`
- NextAuth (Credentials provider — accounts are admin-issued, no
  self-registration)
- Tailwind CSS v4
- `@react-pdf/renderer` for generated invoice/quote PDFs (with embedded
  Czech "QR Platba" payment codes and ISDOC e-invoicing XML)
- Free public APIs with no key required: ARES (Czech business registry,
  IČO/DIČ lookup) and Photon/OpenStreetMap (worldwide address
  autocomplete)

## Getting started

```bash
cd web
npm install
npm run dev:demo   # seeds a demo dataset and starts the dev server
```

Then sign in at `http://localhost:3000/login` with `admin@eventsystem.cz`
/ `changeme123` (or any of the other seeded demo accounts — see
`web/prisma/seed.ts`).

To start from a genuinely empty database instead of the demo dataset, use
`npm run dev:empty`. See `CLAUDE.md` for the full list of available
commands, environment variables, and architecture notes.

## Deployment

The `web/` app is deployed to Railway (Node + a persistent volume for the
SQLite database and uploaded files). See `CLAUDE.md`'s environment section
for the deployment walkthrough and required environment variables.
