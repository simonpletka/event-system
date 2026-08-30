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
            { number: { contains: filters.q } },
            { contacts: { some: { name: { contains: filters.q } } } },
          ],
        }
      : {}),
  };

  const [events, total, clients, places] = await Promise.all([
    prisma.event.findMany({
      where,
      include: { venues: true },
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
      roadmapItems: { orderBy: { date: "asc" } },
      members: { include: { user: true } },
      owner: true,
      expenses: { include: { paidBy: true }, orderBy: { date: "desc" } },
      timeEntries: { include: { user: true }, orderBy: { date: "desc" } },
      quotes: { orderBy: { issuedAt: "desc" } },
      invoices: { orderBy: { issuedAt: "desc" } },
      contacts: { orderBy: { sortOrder: "asc" } },
    },
  });
  return event;
});

/**
 * The Roadmap tab's own query — the deep includes (assignees, external
 * attendees, comment threads) that `getEventDetail` deliberately keeps
 * shallow so Overview/Finance don't pay for them.
 */
export const getEventRoadmap = cache(async function getEventRoadmap(user: SessionUser, id: string) {
  return prisma.event.findFirst({
    where: { id, ...eventWhereForUser(user) },
    include: {
      members: { include: { user: true } },
      contacts: { orderBy: { sortOrder: "asc" } },
      roadmapItems: {
        orderBy: { date: "asc" },
        include: {
          assignees: { include: { user: true } },
          externalAttendees: true,
          comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
          createdBy: true,
        },
      },
    },
  });
});
