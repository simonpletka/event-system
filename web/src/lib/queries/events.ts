import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { eventWhereForUser, type SessionUser } from "@/lib/authz";
import type { EventStatus, Prisma } from "@/generated/prisma/client";

export type EventListFilters = {
  q?: string;
  status?: EventStatus;
  client?: string;
  place?: string;
};

export async function getEventList(user: SessionUser, filters: EventListFilters) {
  const where: Prisma.EventWhereInput = {
    ...eventWhereForUser(user),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.client ? { companyName: filters.client } : {}),
    ...(filters.place ? { venues: { some: { name: filters.place } } } : {}),
    ...(filters.q
      ? {
          OR: [
            { title: { contains: filters.q } },
            { companyName: { contains: filters.q } },
            { clientName: { contains: filters.q } },
          ],
        }
      : {}),
  };

  const [events, total, clients, places] = await Promise.all([
    prisma.event.findMany({
      where,
      include: {
        venues: true,
        milestones: { where: { date: { gte: new Date() } }, orderBy: { date: "asc" }, take: 1 },
      },
      orderBy: { startDate: "asc" },
    }),
    prisma.event.count({ where: eventWhereForUser(user) }),
    prisma.event.findMany({
      where: eventWhereForUser(user),
      select: { companyName: true },
      distinct: ["companyName"],
      orderBy: { companyName: "asc" },
    }),
    prisma.venue.findMany({
      where: { event: eventWhereForUser(user) },
      select: { name: true },
      distinct: ["name"],
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    events,
    total,
    activeCount: events.filter((e) => !["CLOSED", "CANCELLED"].includes(e.status)).length,
    clients: clients.map((c) => c.companyName),
    places: places.map((p) => p.name),
  };
}

export const getEventDetail = cache(async function getEventDetail(user: SessionUser, id: string) {
  const event = await prisma.event.findFirst({
    where: { id, ...eventWhereForUser(user) },
    include: {
      venues: true,
      milestones: { orderBy: { date: "asc" } },
      members: { include: { user: true } },
      owner: true,
      expenses: { include: { paidBy: true }, orderBy: { date: "desc" } },
      timeEntries: { include: { user: true }, orderBy: { date: "desc" } },
      quotes: { orderBy: { issuedAt: "desc" } },
      invoices: { orderBy: { issuedAt: "desc" } },
    },
  });
  return event;
});
