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

/** Tariffs live in the DB so they can be corrected from Settings; the first read fills in the defaults. */
export async function getCarsharingPlans() {
  if ((await prisma.carsharingPlan.count()) === 0) {
    await prisma.carsharingPlan.createMany({ data: DEFAULT_CARSHARING_PLANS });
  }
  return prisma.carsharingPlan.findMany({ orderBy: [{ sortOrder: "asc" }, { provider: "asc" }] });
}
