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

/**
 * Bookings that may matter for a range: those overlapping it, plus every
 * unit that's picked up and not back yet (it keeps blocking past its end
 * date, see blockedRange). The exact test is bookingBlocks() in
 * gear-reservations.ts; this only has to fetch enough.
 */
export function bookingsTouchingWhere(startDate: string, endDate: string): Prisma.GearReservationWhereInput {
  return {
    startDate: { lte: endDate },
    OR: [{ endDate: { gte: startDate } }, { pickedUpAt: { not: null }, returnedAt: null }],
  };
}

/** Units that can't be booked on `day`: unusable conditions, or IN_SERVICE until its backAt. */
export function unusableOnWhere(day: string): Prisma.GearUnitWhereInput {
  return {
    OR: [
      { condition: { in: ["DAMAGED", "RETIRED", "LOST"] } },
      { condition: "IN_SERVICE", OR: [{ backAt: null }, { backAt: { gte: day } }] },
    ],
  };
}
