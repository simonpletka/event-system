import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { EventsAccess, FinanceAccess, ExpensesAccess, SettingsAccess } from "@/generated/prisma/enums";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: "ADMIN" | "ACCOUNTANT" | "PRODUCER" | "MEMBER";
  isCardHolder: boolean;
  /** Set only when the user has a CustomRole assigned; overrides `role` entirely when present. */
  customRole: { events: EventsAccess; finance: FinanceAccess; expenses: ExpensesAccess; settings: SettingsAccess } | null;
};

/**
 * Every server action/page that touches protected data calls this first.
 * Per Next's own guidance for the proxy/middleware convention, auth checks
 * belong in each server function rather than a single global gate.
 *
 * Also re-checks `active` against the DB on every call (not just at login) —
 * a deactivated account's JWT would otherwise stay valid until it expires,
 * which defeats the point of "remove this member". Just redirects rather
 * than also clearing the cookie: `signOut()` mutates cookies, which Next
 * only allows from a Server Action or Route Handler, not mid-render here —
 * the login page's own active-check (see login/page.tsx) is what actually
 * stops the stale cookie from bouncing them back to /dashboard. Wrapped in
 * `cache()` so a single request's several `requireUser()` calls (layout +
 * page, etc.) only hit the DB once.
 */
export const requireUser = cache(async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const current = await prisma.user.findUnique({ where: { id: session.user.id }, select: { active: true } });
  if (!current?.active) redirect("/login");

  return session.user;
});

type Permissions = { events: EventsAccess; finance: FinanceAccess; expenses: ExpensesAccess; settings: SettingsAccess };

// What each built-in role resolves to, expressed in the same four-dimension
// shape a CustomRole uses — this is what lets every check below treat built-in
// and custom roles identically instead of special-casing one or the other.
const BUILT_IN_PERMISSIONS: Record<SessionUser["role"], Permissions> = {
  ADMIN: { events: "ALL_FULL", finance: "FULL", expenses: "FULL", settings: "USERS_AND_COMPANY" },
  ACCOUNTANT: { events: "ALL_READ", finance: "FULL", expenses: "FULL", settings: "COMPANY" },
  PRODUCER: { events: "OWN_EDIT", finance: "READ_OWN_EVENTS", expenses: "ADD_ON_OWN_EVENTS", settings: "NONE" },
  MEMBER: { events: "ASSIGNED_READ", finance: "NONE", expenses: "OWN_ONLY", settings: "NONE" },
};

function resolvePermissions(user: SessionUser): Permissions {
  return user.customRole ?? BUILT_IN_PERMISSIONS[user.role];
}

/** Brief §2.2: Admin/Accountant see every event; Producer/Member see only their own. */
export function eventWhereForUser(user: SessionUser): Prisma.EventWhereInput {
  const p = resolvePermissions(user).events;
  if (p === "ALL_READ" || p === "ALL_FULL") return {};
  return { members: { some: { userId: user.id } } };
}

/** Brief §2.2: only Admin/Producer create events; Accountant/Member cannot. */
export function canCreateEvent(user: SessionUser) {
  const p = resolvePermissions(user).events;
  return p === "ALL_FULL" || p === "OWN_EDIT";
}

/** Brief §2.2: Producer can edit own/assigned events; Member is read-only; Admin always can. */
export function canEditEvent(user: SessionUser, event: { ownerId: string; memberIds: string[] }) {
  const p = resolvePermissions(user).events;
  if (p === "ALL_FULL") return true;
  if (p === "OWN_EDIT") return event.ownerId === user.id || event.memberIds.includes(user.id);
  return false;
}

// --- Finance (brief §2.2 "Finance (nabídky/faktury)" column) ---

/** Full or read-only access: full access. Producer-tier: view-only on own/assigned events. None: no access. */
export function canViewFinance(user: SessionUser) {
  return resolvePermissions(user).finance !== "NONE";
}

/** Only full-finance-access roles can create/edit/convert quotes & invoices, record payments. */
export function canManageFinance(user: SessionUser) {
  return resolvePermissions(user).finance === "FULL";
}

/** Quotes/invoices scoped like events: full access sees all, read-own-events sees own/assigned. */
export function quoteWhereForUser(user: SessionUser): Prisma.QuoteWhereInput {
  return financeWhere(user);
}

export function invoiceWhereForUser(user: SessionUser): Prisma.InvoiceWhereInput {
  return financeWhere(user);
}

function financeWhere(user: SessionUser) {
  const p = resolvePermissions(user).finance;
  if (p === "FULL") return {};
  if (p === "READ_OWN_EVENTS") return { event: { members: { some: { userId: user.id } } } };
  return { id: "" }; // NONE — page-gated by canViewFinance already, this is a defensive no-match fallback
}

// --- Expenses (brief §2.2 "Výdaje" column) ---

/** Full access: all. Own-events tier: add/view on own/assigned events. Own-only tier: add/view own only. */
export function expenseWhereForUser(user: SessionUser): Prisma.ExpenseWhereInput {
  const p = resolvePermissions(user).expenses;
  if (p === "FULL") return {};
  if (p === "ADD_ON_OWN_EVENTS") return { event: { members: { some: { userId: user.id } } } };
  return { paidById: user.id }; // OWN_ONLY and NONE (page-gated) both fall back to own-only
}

export function canAddExpense(user: SessionUser, event: { ownerId: string; memberIds: string[] } | null) {
  const p = resolvePermissions(user).expenses;
  if (p === "FULL") return true;
  if (p === "NONE") return false;
  if (!event) return true; // company overhead — anyone with any expense access can log their own
  return event.ownerId === user.id || event.memberIds.includes(user.id);
}

/** Restricts the "paid by" field to self unless the user is a card holder (brief §5.3 vs §2.2, see CLAUDE.md). */
export function canPickOtherPayer(user: SessionUser) {
  return resolvePermissions(user).expenses !== "OWN_ONLY" || user.isCardHolder;
}

// --- Time tracker (brief §6.3: "Member sees own only; Producer sees own events'
// summary; Admin and Accountant ('Finance manažer') see all.") ---

/** Everyone can see their own entries; scoping only matters for entries by *other* people. */
export function timeEntryWhereForUser(user: SessionUser): Prisma.TimeEntryWhereInput {
  const p = resolvePermissions(user).events;
  if (p === "ALL_READ" || p === "ALL_FULL") return {};
  if (p === "OWN_EDIT") {
    return { OR: [{ userId: user.id }, { event: { members: { some: { userId: user.id } } } }] };
  }
  return { userId: user.id };
}

// --- Settings (brief §2.2 "Nastavení" column) ---

/** Only the top settings tier manages user accounts, roles and custom roles. */
export function canManageUsers(user: SessionUser) {
  return resolvePermissions(user).settings === "USERS_AND_COMPANY";
}

/** Company-tier and above can edit company data / invoice template settings. */
export function canManageCompanySettings(user: SessionUser) {
  return resolvePermissions(user).settings !== "NONE";
}

// --- Deletion (events, quotes, invoices, expenses) ---

/**
 * Deliberately checks the literal built-in Admin role rather than a
 * permission tier — a CustomRole can be granted ALL_FULL/FULL access for
 * day-to-day work without also getting the irreversible-delete button.
 * `customRole` is only ever non-null when `role` holds its least-privilege
 * MEMBER fallback (see resolvePermissions()), so this can't be spoofed by
 * assigning a custom role that happens to be named/configured like Admin.
 */
export function isAdmin(user: SessionUser) {
  return user.customRole === null && user.role === "ADMIN";
}
