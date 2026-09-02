import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { ProjectsAccess, FinanceAccess, ExpensesAccess, SettingsAccess } from "@/generated/prisma/enums";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: "ADMIN" | "ACCOUNTANT" | "PRODUCER" | "MEMBER";
  isCardHolder: boolean;
  /** Set only when the user has a CustomRole assigned; overrides `role` entirely when present. */
  customRole: { projects: ProjectsAccess; finance: FinanceAccess; expenses: ExpensesAccess; settings: SettingsAccess } | null;
};

/**
 * The DB-truth fields that can go stale on the JWT-backed `SessionUser`
 * between logins — `active` (deactivation), plus everything the new
 * self-service General settings tab lets someone change about their own
 * account (name/email/phone/avatar/locale never get written back into the
 * session token). One shared `cache()`-wrapped lookup rather than a
 * separate ad-hoc query in `requireUser()`, `getLocale()`, and the app
 * layout's avatar/name display — all three want a fresh User row for the
 * current session's id within the same request, and `cache()` dedupes by
 * function+args, so calling this from all three collapses to one query.
 */
export const getFreshUserFields = cache(async function getFreshUserFields(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      active: true,
      name: true,
      email: true,
      phone: true,
      avatarPath: true,
      locale: true,
      role: true,
      isCardHolder: true,
      customRoleId: true,
      customRole: { select: { projects: true, finance: true, expenses: true, settings: true } },
    },
  });
});

/**
 * Every server action/page that touches protected data calls this first.
 * Per Next's own guidance for the proxy/middleware convention, auth checks
 * belong in each server function rather than a single global gate.
 *
 * Builds the returned `SessionUser` entirely from a fresh DB row rather
 * than trusting the JWT's `role`/`isCardHolder`/`customRole` — those are
 * only written into the token once, at sign-in (see `auth.ts`'s `jwt`
 * callback), so an admin editing *someone else's* role/custom-role/card-flag
 * while that person has an existing session previously had no effect until
 * they logged out and back in. Re-checking `active` against the DB on every
 * call already existed for the same reason (a deactivated account's JWT
 * would otherwise stay valid until it expires) — this extends that same
 * "the token is a cache, not the source of truth" fix to every other
 * permission-relevant field. `id`/`name`/`email` still come from the fresh
 * row too, for consistency, though those were already re-fetched
 * separately wherever they're actually displayed (see `(app)/layout.tsx`).
 * Wrapped in `cache()` so a single request's several `requireUser()` calls
 * (layout + page, etc.) only hit the DB once.
 */
export const requireUser = cache(async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const current = await getFreshUserFields(session.user.id);
  if (!current?.active) redirect("/login");

  return {
    id: session.user.id,
    name: current.name,
    email: current.email,
    role: current.role,
    isCardHolder: current.isCardHolder,
    customRole: current.customRoleId && current.customRole ? current.customRole : null,
  };
});

type Permissions = { projects: ProjectsAccess; finance: FinanceAccess; expenses: ExpensesAccess; settings: SettingsAccess };

// What each built-in role resolves to, expressed in the same four-dimension
// shape a CustomRole uses — this is what lets every check below treat built-in
// and custom roles identically instead of special-casing one or the other.
const BUILT_IN_PERMISSIONS: Record<SessionUser["role"], Permissions> = {
  ADMIN: { projects: "ALL_FULL", finance: "FULL", expenses: "FULL", settings: "USERS_AND_COMPANY" },
  ACCOUNTANT: { projects: "ALL_READ", finance: "FULL", expenses: "FULL", settings: "COMPANY" },
  PRODUCER: { projects: "OWN_EDIT", finance: "READ_OWN_PROJECTS", expenses: "ADD_ON_OWN_PROJECTS", settings: "NONE" },
  MEMBER: { projects: "ASSIGNED_READ", finance: "NONE", expenses: "OWN_ONLY", settings: "NONE" },
};

function resolvePermissions(user: SessionUser): Permissions {
  return user.customRole ?? BUILT_IN_PERMISSIONS[user.role];
}

/**
 * Who can *see* a project at all. Admin/Accountant (ALL_*) and Member
 * (ASSIGNED_READ) can open any project — Member read-only, everyone above per
 * their own edit gate. Only the NONE tier (a custom role with projects access
 * switched off) is narrowed to projects they're a member of. Editing, finance
 * and budget are gated separately (canEditProject / canViewFinance /
 * canViewProjectBudget), so widening this for Member doesn't grant them anything
 * but visibility.
 */
export function projectWhereForUser(user: SessionUser): Prisma.ProjectWhereInput {
  const p = resolvePermissions(user).projects;
  if (p === "NONE") return { members: { some: { userId: user.id } } };
  return {};
}

/**
 * Projects a user is actually on — owner or a ProjectMember row. Used by the
 * per-role dashboards' "My projects" sections, which stay the assigned set even
 * though `projectWhereForUser` is now unrestricted for Member.
 */
export function assignedProjectWhere(user: SessionUser): Prisma.ProjectWhereInput {
  return { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] };
}

/**
 * Which of the four role dashboards a user sees. Derived from resolved
 * permissions, not the literal role, so a CustomRole lands on the nearest
 * sensible variant instead of a broken page. Maps the four built-ins exactly:
 * ADMIN→admin, ACCOUNTANT→accountant, PRODUCER→producer, MEMBER→member.
 */
export type DashboardVariant = "admin" | "accountant" | "producer" | "member";

export function dashboardVariant(user: SessionUser): DashboardVariant {
  if (isAdmin(user)) return "admin";
  const p = resolvePermissions(user);
  if (p.finance === "FULL" && p.projects === "ALL_FULL") return "admin";
  if (p.finance === "FULL") return "accountant";
  if (canCreateProject(user)) return "producer";
  return "member";
}

/** Brief §2.2: only Admin/Producer create projects; Accountant/Member cannot. */
export function canCreateProject(user: SessionUser) {
  const p = resolvePermissions(user).projects;
  return p === "ALL_FULL" || p === "OWN_EDIT";
}

/** Brief §2.2: Producer can edit own/assigned projects; Member is read-only; Admin always can. */
export function canEditProject(user: SessionUser, project: { ownerId: string; memberIds: string[] }) {
  const p = resolvePermissions(user).projects;
  if (p === "ALL_FULL") return true;
  if (p === "OWN_EDIT") return project.ownerId === user.id || project.memberIds.includes(user.id);
  return false;
}

/**
 * Who sees the project's internal budget (the read-only tile on the project
 * detail page): anyone who works with money (Accountant, Admin — via
 * finance access) or runs projects (Producer — via create access). Members
 * and finance-less custom roles don't. Editing the budget is a stricter
 * gate still — isAdmin() only, checked on the project form/action.
 */
export function canViewProjectBudget(user: SessionUser) {
  return canViewFinance(user) || canCreateProject(user);
}

// --- Finance (brief §2.2 "Finance (nabídky/faktury)" column) ---

/** Full or read-only access: full access. Producer-tier: view-only on own/assigned projects. None: no access. */
export function canViewFinance(user: SessionUser) {
  return resolvePermissions(user).finance !== "NONE";
}

/** Only full-finance-access roles can create/edit/convert quotes & invoices, record payments. */
export function canManageFinance(user: SessionUser) {
  return resolvePermissions(user).finance === "FULL";
}

/** Quotes/invoices scoped like projects: full access sees all, read-own-projects sees own/assigned. */
export function quoteWhereForUser(user: SessionUser): Prisma.QuoteWhereInput {
  return financeWhere(user);
}

export function invoiceWhereForUser(user: SessionUser): Prisma.InvoiceWhereInput {
  return financeWhere(user);
}

function financeWhere(user: SessionUser) {
  const p = resolvePermissions(user).finance;
  if (p === "FULL") return {};
  if (p === "READ_OWN_PROJECTS") return { project: { members: { some: { userId: user.id } } } };
  return { id: "" }; // NONE — page-gated by canViewFinance already, this is a defensive no-match fallback
}

// --- Expenses (brief §2.2 "Výdaje" column) ---

/** Full access: all. Own-projects tier: add/view on own/assigned projects. Own-only tier: add/view own only. */
export function expenseWhereForUser(user: SessionUser): Prisma.ExpenseWhereInput {
  const p = resolvePermissions(user).expenses;
  if (p === "FULL") return {};
  if (p === "ADD_ON_OWN_PROJECTS") return { project: { members: { some: { userId: user.id } } } };
  return { paidById: user.id }; // OWN_ONLY and NONE (page-gated) both fall back to own-only
}

/**
 * Any expense access at all — gates the Finance section's Expenses sub-tab
 * (list + "new expense") independently of quote/invoice access, so a Member
 * (finance NONE, expenses OWN_ONLY) can still log and review their own
 * expenses. Quotes/invoices/reports stay behind canViewFinance.
 */
export function canViewExpenses(user: SessionUser) {
  return resolvePermissions(user).expenses !== "NONE";
}

export function canAddExpense(user: SessionUser, project: { ownerId: string; memberIds: string[] } | null) {
  const p = resolvePermissions(user).expenses;
  if (p === "FULL") return true;
  if (p === "NONE") return false;
  if (!project) return true; // company overhead — anyone with any expense access can log their own
  return project.ownerId === user.id || project.memberIds.includes(user.id);
}

/** Restricts the "paid by" field to self unless the user is a card holder (brief §5.3 vs §2.2, see CLAUDE.md). */
export function canPickOtherPayer(user: SessionUser) {
  return resolvePermissions(user).expenses !== "OWN_ONLY" || user.isCardHolder;
}

/** Full expense access can edit any expense; everyone else only their own (matches who could have logged it). */
export function canEditExpense(user: SessionUser, expensePaidById: string) {
  return resolvePermissions(user).expenses === "FULL" || expensePaidById === user.id;
}

// --- Time tracker (brief §6.3: "Member sees own only; Producer sees own projects'
// summary; Admin and Accountant ('Finance manažer') see all.") ---

/** Everyone can see their own entries; scoping only matters for entries by *other* people. */
export function timeEntryWhereForUser(user: SessionUser): Prisma.TimeEntryWhereInput {
  const p = resolvePermissions(user).projects;
  if (p === "ALL_READ" || p === "ALL_FULL") return {};
  if (p === "OWN_EDIT") {
    return { OR: [{ userId: user.id }, { project: { members: { some: { userId: user.id } } } }] };
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

// --- Clients (new — not in the brief's own RBAC table, since the section
// itself is new). Deliberately reuses the same two roles who already touch
// a client's company data day to day — Producer via creating/editing
// projects, Accountant/Admin via Finance — rather than inventing a fifth
// permission dimension for one screen. Member gets neither, same as
// Finance. Viewing and managing aren't split into separate tiers here. ---
export function canManageClients(user: SessionUser) {
  return canManageFinance(user) || canCreateProject(user);
}

// --- Meetings (new — reuses the `projects` dimension rather than adding a
// fifth CustomRole tier, since a meeting is fundamentally a projects-adjacent
// concept: anyone who can see projects can see meetings, anyone who can
// create/edit projects can manage them). ---
export function canViewMeetings(user: SessionUser) {
  return resolvePermissions(user).projects !== "NONE";
}

export function canManageMeetings(user: SessionUser) {
  return canCreateProject(user);
}

// --- Deletion (projects, quotes, invoices, expenses) ---

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

/**
 * Literal built-in Accountant (not a custom role). Only used to gate the
 * budget "% of quoted value" basis line on the Finance tab — Producers see
 * the budget figure but not how it relates to the client quote.
 */
export function isAccountant(user: SessionUser) {
  return user.customRole === null && user.role === "ACCOUNTANT";
}
