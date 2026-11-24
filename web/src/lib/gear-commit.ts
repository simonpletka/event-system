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
  /** Reuse this batch id (when an edit replaces a batch). */
  batchId?: string;
  /** Units to keep if they're still free (when editing). */
  preferUnitIds?: string[];
  /**
   * The number of units the person agreed to in the preview. A plan with fewer
   * free units than this is refused, so nothing is ever reserved short without
   * their say. Omit to require every line in full.
   */
  expectedUnits?: number;
};

export type CommitResult =
  | { ok: true; batchId: string; plan: LinePlan[] }
  | { ok: false; reason: "short" | "empty" | "collision" | "missing"; plan: LinePlan[] };

export class GearCollisionError extends Error {}

/** Thrown inside a transaction to roll back an edit whose new plan was refused; carries the result. */
export class GearPlanRejected extends Error {
  constructor(public result: CommitResult) {
    super("The edited reservation couldn't be planned.");
  }
}

/** The plan for these lines from the database's current state. */
export async function planFromDb(tx: Tx, lines: PlanLine[], startDate: string, endDate: string, preferUnitIds: string[] = []) {
  const typeIds = [...new Set(lines.map((l) => l.typeId))];
  const units = await tx.gearUnit.findMany({
    where: { typeId: { in: typeIds }, active: true },
    select: { id: true, typeId: true, number: true, active: true },
  });
  const bookings = await tx.gearReservation.findMany({
    where: { unitId: { in: units.map((u) => u.id) }, startDate: { lte: endDate }, endDate: { gte: startDate } },
    select: { unitId: true, startDate: true, endDate: true },
  });
  return planReservation(lines, units, bookings, { startDate, endDate }, new Set(preferUnitIds));
}

export async function commitGearReservation(tx: Tx, input: CommitInput): Promise<CommitResult> {
  const plan = await planFromDb(tx, input.lines, input.startDate, input.endDate, input.preferUnitIds);
  const picked = plan.flatMap((l) => l.units);
  const wanted = plan.reduce((n, l) => n + l.quantity, 0);
  const required = input.expectedUnits ?? wanted;

  if (picked.length === 0) return { ok: false, reason: "empty", plan };
  if (picked.length < required) return { ok: false, reason: "short", plan };

  const batchId = input.batchId ?? randomUUID();
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

/**
 * Replaces a batch with a new plan: new dates, project, note or items. The
 * old rows are removed first so they don't block their own new dates, and the
 * units it held are preferred. A refused plan throws GearPlanRejected, which
 * rolls the removal back with the rest of the transaction.
 */
export async function replaceGearBatch(tx: Tx, batchId: string, input: Omit<CommitInput, "batchId" | "groupId" | "preferUnitIds">): Promise<CommitResult> {
  const old = await tx.gearReservation.findMany({ where: { batchId }, select: { unitId: true, groupId: true } });
  if (old.length === 0) return { ok: false, reason: "missing", plan: [] };
  await tx.gearReservation.deleteMany({ where: { batchId } });
  const result = await commitGearReservation(tx, { ...input, batchId, groupId: old[0].groupId, preferUnitIds: old.map((o) => o.unitId) });
  if (!result.ok) throw new GearPlanRejected(result);
  return result;
}
