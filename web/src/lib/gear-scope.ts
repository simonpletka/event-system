import type { Prisma } from "@/generated/prisma/client";

export type ReservationScope = "all" | "project" | "none";

/**
 * Which reservations the Reservations tab lists, from today on. Project
 * bookings only where the project is visible (`projectWhere`, from
 * projectWhereForUser). The explicit `is` matters: on this optional relation
 * Prisma reads a bare `project: {}` (what an all-projects user gets) as
 * matching nothing, which once hid every project booking from Admins.
 */
export function reservationScopeWhere(projectWhere: Prisma.ProjectWhereInput, show: ReservationScope, today: string): Prisma.GearReservationWhereInput {
  const visibleProject: Prisma.GearReservationWhereInput = { project: { is: projectWhere } };
  if (show === "none") return { endDate: { gte: today }, projectId: null };
  if (show === "project") return { endDate: { gte: today }, AND: [{ projectId: { not: null } }, visibleProject] };
  return { endDate: { gte: today }, OR: [{ projectId: null }, visibleProject] };
}
