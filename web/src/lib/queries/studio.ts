import { prisma } from "@/lib/prisma";
import { projectWhereForUser, canEditProject, isAdmin, type SessionUser } from "@/lib/authz";
import type { Prisma } from "@/generated/prisma/client";

/** Unlinked work is shared by everyone; linked work follows the project's visibility. */
export function studioWorkWhereForUser(user: SessionUser): Prisma.StudioWorkWhereInput {
  // `is` is needed: a bare `project: {}` (what an admin's filter is) matches nothing.
  return { OR: [{ projectId: null }, { project: { is: projectWhereForUser(user) } }] };
}

/** Anyone may change unlinked work; linked work needs edit rights on the project, or being its author or an admin. */
export function canEditStudioWork(
  user: SessionUser,
  work: { createdById: string | null; project: { ownerId: string; members: { userId: string }[] } | null }
) {
  if (isAdmin(user) || !work.project || work.createdById === user.id) return true;
  return canEditProject(user, { ownerId: work.project.ownerId, memberIds: work.project.members.map((m) => m.userId) });
}

const listSelect = {
  id: true,
  app: true,
  title: true,
  projectId: true,
  updatedAt: true,
  project: { select: { number: true, title: true } },
  createdBy: { select: { name: true } },
} satisfies Prisma.StudioWorkSelect;

export function getStudioWorks(user: SessionUser, where: Prisma.StudioWorkWhereInput = {}) {
  return prisma.studioWork.findMany({
    where: { AND: [studioWorkWhereForUser(user), where] },
    select: listSelect,
    orderBy: { updatedAt: "desc" },
  });
}

export function getStudioWork(user: SessionUser, id: string) {
  return prisma.studioWork.findFirst({
    where: { AND: [studioWorkWhereForUser(user), { id }] },
    include: { project: { select: { ownerId: true, members: { select: { userId: true } } } } },
  });
}

/** Projects a work can be linked to: those the user may edit. */
export async function getStudioProjectOptions(user: SessionUser) {
  const projects = await prisma.project.findMany({
    where: projectWhereForUser(user),
    select: { id: true, number: true, title: true, ownerId: true, members: { select: { userId: true } } },
    orderBy: { startDate: "desc" },
  });
  return projects
    .filter((p) => canEditProject(user, { ownerId: p.ownerId, memberIds: p.members.map((m) => m.userId) }))
    .map((p) => ({ id: p.id, label: `${p.number} · ${p.title}` }));
}
