/**
 * Commits a gear reservation inside a transaction. Not a server action: the
 * action in lib/actions/gear.ts checks permissions and calls this inside
 * `prisma.$transaction`, and the tests run it against a real SQLite file.
 *
 * It re-plans from what's in the database at that moment rather than trusting
 * the preview, so two people reserving at once can't get the same unit. SQLite
 * serialises writes; the check after inserting is the belt to that braces.
 */
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { planReservation, rangesOverlap, type LinePlan, type PlanLine } from "./gear-reservations";

type Tx = Pick<Prisma.TransactionClient, "gearUnit" | "gearReservation">;

export type CommitInput = {
  lines: PlanLine[];
  startDate: string;
  endDate: string;
  /** Null books the gear for no project; `note` then says what for. */
  projectId: string | null;
  note?: string;
  groupId: string | null;
  userId: string | null;
  /**
   * The number of units the person agreed to in the preview. A plan with fewer
   * free units than this is refused, so nothing is ever reserved short without
   * their say. Omit to require every line in full.
   */
  expectedUnits?: number;
};

export type CommitResult =
  | { ok: true; batchId: string; plan: LinePlan[] }
  | { ok: false; reason: "short" | "empty" | "collision"; plan: LinePlan[] };

export class GearCollisionError extends Error {}

/** The plan for these lines from the database's current state. */
export async function planFromDb(tx: Tx, lines: PlanLine[], startDate: string, endDate: string) {
  const typeIds = [...new Set(lines.map((l) => l.typeId))];
  const units = await tx.gearUnit.findMany({
    where: { typeId: { in: typeIds }, active: true },
    select: { id: true, typeId: true, number: true, active: true },
  });
  const bookings = await tx.gearReservation.findMany({
    where: { unitId: { in: units.map((u) => u.id) }, startDate: { lte: endDate }, endDate: { gte: startDate } },
    select: { unitId: true, startDate: true, endDate: true },
  });
  return planReservation(lines, units, bookings, { startDate, endDate });
}

export async function commitGearReservation(tx: Tx, input: CommitInput): Promise<CommitResult> {
  const plan = await planFromDb(tx, input.lines, input.startDate, input.endDate);
  const picked = plan.flatMap((l) => l.units);
  const wanted = plan.reduce((n, l) => n + l.quantity, 0);
  const required = input.expectedUnits ?? wanted;

  if (picked.length === 0) return { ok: false, reason: "empty", plan };
  if (picked.length < required) return { ok: false, reason: "short", plan };

  const batchId = randomUUID();
  const range = { startDate: input.startDate, endDate: input.endDate };
  for (const unit of picked) {
    await tx.gearReservation.create({
      data: {
        unitId: unit.id,
        projectId: input.projectId,
        note: input.note ?? "",
        startDate: input.startDate,
        endDate: input.endDate,
        batchId,
        groupId: input.groupId,
        createdById: input.userId,
      },
    });
  }

  // Each unit must now hold exactly one booking in the range: ours.
  const after = await tx.gearReservation.findMany({
    where: { unitId: { in: picked.map((u) => u.id) }, startDate: { lte: input.endDate }, endDate: { gte: input.startDate } },
    select: { unitId: true, startDate: true, endDate: true, batchId: true },
  });
  const clash = after.some((b) => b.batchId !== batchId && rangesOverlap(b, range));
  if (clash) throw new GearCollisionError("A unit was booked by someone else at the same time.");

  return { ok: true, batchId, plan };
}
