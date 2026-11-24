/**
 * A unit's history (GearUnitEvent), written by the action that makes the
 * change, inside its transaction. Append-only; not a general audit log.
 */
import type { Prisma } from "@/generated/prisma/client";
import type { GearUnitEventType } from "@/generated/prisma/enums";
import { shiftDateKey } from "./prague-date";
import { unitUsableOn, type GearConditionValue } from "./gear-reservations";

type Tx = Pick<Prisma.TransactionClient, "gearUnitEvent">;

export function logUnitEvent(tx: Tx, unitId: string, type: GearUnitEventType, actorId: string | null, data: Record<string, unknown> = {}) {
  return tx.gearUnitEvent.create({ data: { unitId, type, actorId, data: JSON.stringify(data) } });
}

/** Pick-up opens this many days before a reservation starts. */
export const PICKUP_WINDOW_DAYS = 1;

/** Is pick-up open for this booking on `day`? From PICKUP_WINDOW_DAYS before its start until its end. */
export function pickupWindowOpen(r: { startDate: string; endDate: string }, day: string) {
  return r.startDate <= shiftDateKey(day, PICKUP_WINDOW_DAYS) && day <= r.endDate;
}

export type PickupBlockReason = "unusable" | "window" | "already" | "returned";

/**
 * Why a reserved unit can't be picked up on `day`, or null when it can.
 * Unusable units (damaged, in service, retired, lost) are blocked: reassign
 * the booking instead. NEEDS_ATTENTION is allowed; the UI warns.
 */
export function pickupBlockReason(
  r: { startDate: string; endDate: string; pickedUpAt: unknown; returnedAt: unknown; unit: { condition: GearConditionValue; backAt?: string | null } },
  day: string
): PickupBlockReason | null {
  if (r.returnedAt) return "returned";
  if (r.pickedUpAt) return "already";
  if (!pickupWindowOpen(r, day)) return "window";
  if (!unitUsableOn(r.unit, day)) return "unusable";
  return null;
}
