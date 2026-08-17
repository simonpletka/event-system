import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Prisma } from "@/generated/prisma/client";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: "ADMIN" | "ACCOUNTANT" | "PRODUCER" | "MEMBER";
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
