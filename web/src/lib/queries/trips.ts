import { prisma } from "@/lib/prisma";
import { DEFAULT_CARSHARING_PLANS } from "@/lib/carsharing-defaults";

export function getProjectTrips(projectId: string) {
  return prisma.trip.findMany({
    where: { projectId },
    include: { stops: { orderBy: { position: "asc" } } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
}

export function getUserVehicles(userId: string) {
  return prisma.vehicle.findMany({ where: { ownerId: userId }, orderBy: { createdAt: "asc" } });
}

/**
 * Tariffs live in the DB so they can be corrected from Settings. An operator
 * with no rows gets its defaults on the next read, which is also how a new
 * price list arrives: a migration deletes that operator's rows.
 */
export async function getCarsharingPlans() {
  const present = new Set((await prisma.carsharingPlan.findMany({ select: { provider: true }, distinct: ["provider"] })).map((p) => p.provider));
  const missing = DEFAULT_CARSHARING_PLANS.filter((p) => !present.has(p.provider));
  if (missing.length > 0) {
    await prisma.carsharingPlan.createMany({ data: missing });
  }
  return prisma.carsharingPlan.findMany({ orderBy: [{ sortOrder: "asc" }, { provider: "asc" }] });
}
