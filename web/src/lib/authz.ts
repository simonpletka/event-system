import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Prisma } from "@/generated/prisma/client";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: "ADMIN" | "ACCOUNTANT" | "PRODUCER" | "MEMBER";
  isCardHolder: boolean;
};

/**
 * Every server action/page that touches protected data calls this first.
 * Per Next's own guidance for the proxy/middleware convention, auth checks
 * belong in each server function rather than a single global gate.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

/** Brief §2.2: Admin/Accountant see every event; Producer/Member see only their own. */
export function eventWhereForUser(user: SessionUser): Prisma.EventWhereInput {
  if (user.role === "ADMIN" || user.role === "ACCOUNTANT") return {};
  return { members: { some: { userId: user.id } } };
}

/** Brief §2.2: only Admin/Producer create events; Accountant/Member cannot. */
export function canCreateEvent(user: SessionUser) {
  return user.role === "ADMIN" || user.role === "PRODUCER";
}

/** Brief §2.2: Producer can edit own/assigned events; Member is read-only; Admin always can. */
export function canEditEvent(user: SessionUser, event: { ownerId: string; memberIds: string[] }) {
  if (user.role === "ADMIN") return true;
  if (user.role === "ACCOUNTANT") return false;
  if (user.role === "PRODUCER") {
    return event.ownerId === user.id || event.memberIds.includes(user.id);
  }
  return false;
}

// --- Finance (brief §2.2 "Finance (nabídky/faktury)" column) ---

/** Admin/Accountant: full access. Producer: view-only on own/assigned events. Member: no access. */
export function canViewFinance(user: SessionUser) {
  return user.role !== "MEMBER";
}

/** Only Admin/Accountant can create/edit/convert quotes & invoices, record payments. */
export function canManageFinance(user: SessionUser) {
  return user.role === "ADMIN" || user.role === "ACCOUNTANT";
}

/** Quotes/invoices scoped like events: Admin/Accountant see all, Producer sees own/assigned. */
export function quoteWhereForUser(user: SessionUser): Prisma.QuoteWhereInput {
  if (user.role === "ADMIN" || user.role === "ACCOUNTANT") return {};
  return { event: { members: { some: { userId: user.id } } } };
}

export function invoiceWhereForUser(user: SessionUser): Prisma.InvoiceWhereInput {
  if (user.role === "ADMIN" || user.role === "ACCOUNTANT") return {};
  return { event: { members: { some: { userId: user.id } } } };
}

// --- Expenses (brief §2.2 "Výdaje" column) ---

/** Admin/Accountant: all. Producer: add/view on own/assigned events. Member: add/view own only. */
export function expenseWhereForUser(user: SessionUser): Prisma.ExpenseWhereInput {
  if (user.role === "ADMIN" || user.role === "ACCOUNTANT") return {};
  if (user.role === "PRODUCER") return { event: { members: { some: { userId: user.id } } } };
  return { paidById: user.id };
}

export function canAddExpense(user: SessionUser, event: { ownerId: string; memberIds: string[] } | null) {
  if (user.role === "ADMIN" || user.role === "ACCOUNTANT") return true;
  if (!event) return true; // company overhead — anyone can log their own
  return event.ownerId === user.id || event.memberIds.includes(user.id);
}

// --- Time tracker (brief §6.3: "Member sees own only; Producer sees own events'
// summary; Admin and Accountant ('Finance manažer') see all.") ---

/** Everyone can see their own entries; scoping only matters for entries by *other* people. */
export function timeEntryWhereForUser(user: SessionUser): Prisma.TimeEntryWhereInput {
  if (user.role === "ADMIN" || user.role === "ACCOUNTANT") return {};
  if (user.role === "PRODUCER") {
    return { OR: [{ userId: user.id }, { event: { members: { some: { userId: user.id } } } }] };
  }
  return { userId: user.id };
}

// --- Settings (brief §2.2 "Nastavení" column) ---

/** Only Admin manages user accounts, roles and invitations. */
export function canManageUsers(user: SessionUser) {
  return user.role === "ADMIN";
}

/** Admin and Accountant can edit company data / invoice template settings. */
export function canManageCompanySettings(user: SessionUser) {
  return user.role === "ADMIN" || user.role === "ACCOUNTANT";
}
