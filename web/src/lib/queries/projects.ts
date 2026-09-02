import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { projectWhereForUser, type SessionUser } from "@/lib/authz";
import type { ProjectStatus, Prisma } from "@/generated/prisma/client";

export type ProjectListFilters = {
  q?: string;
  status?: ProjectStatus;
  client?: string;
  place?: string;
};

export async function getProjectList(user: SessionUser, filters: ProjectListFilters) {
  const where: Prisma.ProjectWhereInput = {
    ...projectWhereForUser(user),
    // Closed projects are still real records (still counted in `total`,
    // still reachable via a direct link) — just excluded from the default
    // list view so it doesn't fill up with wrapped-up work. Selecting
    // "Closed" explicitly in the status filter still shows them.
    ...(filters.status ? { status: filters.status } : { status: { not: "CLOSED" } }),
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

  const [projects, total, clients, places] = await Promise.all([
    prisma.project.findMany({
      where,
      include: { venues: true, client: { select: { id: true, name: true } } },
      orderBy: { startDate: "asc" },
    }),
    prisma.project.count({ where: projectWhereForUser(user) }),
    prisma.project.findMany({
      where: projectWhereForUser(user),
      select: { companyName: true },
      distinct: ["companyName"],
      orderBy: { companyName: "asc" },
    }),
    prisma.venue.findMany({
      where: { project: projectWhereForUser(user) },
      select: { name: true },
      distinct: ["name"],
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    projects,
    total,
    activeCount: projects.filter((e) => !["CLOSED", "CANCELLED"].includes(e.status)).length,
    clients: clients.map((c) => c.companyName),
    places: places.map((p) => p.name),
  };
}

/**
 * Resolves a project's "YY-XXX" number (the authoritative part of its URL
 * slug — see src/lib/slug.ts) to its real id. Not auth-scoped itself; the
 * `projectWhereForUser` filter inside getProjectDetail/getProjectRoadmap
 * (called right after, with this resolved id) still enforces visibility
 * exactly as before slugged URLs existed.
 */
export const resolveProjectIdByNumber = cache(async function resolveProjectIdByNumber(number: string) {
  const project = await prisma.project.findFirst({ where: { number }, select: { id: true } });
  return project?.id ?? null;
});

export const getProjectDetail = cache(async function getProjectDetail(user: SessionUser, id: string) {
  const project = await prisma.project.findFirst({
    where: { id, ...projectWhereForUser(user) },
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
  return project;
});

/**
 * The Roadmap tab's own query — the deep includes (assignees, external
 * attendees, comment threads) that `getProjectDetail` deliberately keeps
 * shallow so Overview/Finance don't pay for them.
 */
export const getProjectRoadmap = cache(async function getProjectRoadmap(user: SessionUser, id: string) {
  return prisma.project.findFirst({
    where: { id, ...projectWhereForUser(user) },
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
