import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/authz";
import { eventWhereForUser } from "@/lib/authz";

export async function getClientList(user: SessionUser, q?: string) {
  const clients = await prisma.client.findMany({
    where: q ? { name: { contains: q } } : undefined,
    include: {
      contacts: { select: { id: true } },
      events: {
        where: eventWhereForUser(user),
        select: { id: true, invoices: { select: { total: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    ico: c.ico,
    contactCount: c.contacts.length,
    eventCount: c.events.length,
    // Deliberately sums raw Int totals across every currency a client's
    // invoices happen to use — same "stats stay CZK, no FX conversion"
    // simplification as Reports/Dashboard. See CLAUDE.md.
    totalCharged: c.events.reduce((sum, e) => sum + e.invoices.reduce((s, i) => s + i.total, 0), 0),
  }));
}

export const getClientDetail = cache(async function getClientDetail(user: SessionUser, id: string) {
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: { name: "asc" } },
      events: {
        where: eventWhereForUser(user),
        include: { invoices: { select: { id: true, number: true, total: true, currency: true, status: true } } },
        orderBy: { startDate: "desc" },
      },
    },
  });
  if (!client) return null;

  const totalCharged = client.events.reduce((sum, e) => sum + e.invoices.reduce((s, i) => s + i.total, 0), 0);
  return { ...client, totalCharged };
});

/**
 * For EventForm's client picker — deliberately unscoped by eventWhereForUser
 * (picking a client isn't the same as seeing their events). Includes the
 * full company fields, not just id/name, so selecting a client can actually
 * pre-fill companyName/Address/Ico/Dic instead of leaving them blank.
 */
export async function getClientOptions() {
  return prisma.client.findMany({
    select: { id: true, name: true, address: true, ico: true, dic: true },
    orderBy: { name: "asc" },
  });
}
