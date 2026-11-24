"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageGear, canReportGearIssue, canHandleGearPickup, projectWhereForUser, type SessionUser } from "@/lib/authz";
import { logUnitEvent, pickupBlockReason } from "@/lib/gear-events";
import { bookingsTouchingWhere } from "@/lib/gear-scope";
import { isDateKey, reassignTarget, type GearConditionValue } from "@/lib/gear-reservations";
import { resolveGearScan } from "@/lib/gear-scan";
import { deleteGearIssuePhoto } from "@/lib/uploads";
import { pragueDateKey } from "@/lib/prague-date";
import { projectHref } from "@/lib/slug";
import { log } from "@/lib/log";

const CONDITIONS: GearConditionValue[] = ["OK", "NEEDS_ATTENTION", "DAMAGED", "IN_SERVICE", "RETIRED", "LOST"];
const SEVERITIES = ["MINOR", "MAJOR", "UNUSABLE"] as const;
const STATUSES = ["OPEN", "IN_SERVICE", "RESOLVED", "WONT_FIX"] as const;

const today = () => pragueDateKey(new Date());

function revalidateGearPages() {
  revalidatePath("/gear", "layout");
  revalidatePath("/g", "layout");
}

/** A reservation with what the pick-up permission needs. */
async function reservationForUser(user: SessionUser, id: string) {
  const r = await prisma.gearReservation.findUnique({
    where: { id },
    include: {
      unit: { select: { id: true, number: true, typeId: true, condition: true, backAt: true } },
      project: { select: { id: true, number: true, title: true, ownerId: true, members: { select: { userId: true } } } },
    },
  });
  if (!r) return null;
  if (r.project && !(await prisma.project.findFirst({ where: { AND: [{ id: r.project.id }, projectWhereForUser(user)] }, select: { id: true } }))) return null;
  return r;
}

function pickupAllowed(user: SessionUser, r: NonNullable<Awaited<ReturnType<typeof reservationForUser>>>) {
  return canHandleGearPickup(user, r.project ? { ownerId: r.project.ownerId, memberIds: r.project.members.map((m) => m.userId) } : null);
}

function revalidateReservation(r: { project: { number: string; title: string } | null; batchId: string }) {
  revalidateGearPages();
  if (r.project) revalidatePath(projectHref(r.project, "/gear"));
}

// --- Condition ---

export type ConditionResult = { ok: true } | { ok: false; error: "noPermission" | "invalid" };

/** Sets a unit's condition. Always an explicit act of a gear manager; reports never do this on their own. */
export async function setGearUnitConditionAction(input: {
  unitId: string;
  condition: GearConditionValue;
  note?: string;
  backAt?: string | null;
}): Promise<ConditionResult> {
  const user = await requireUser();
  if (!canManageGear(user)) return { ok: false, error: "noPermission" };
  if (!CONDITIONS.includes(input.condition)) return { ok: false, error: "invalid" };
  const backAt = input.condition === "IN_SERVICE" && input.backAt ? input.backAt : null;
  if (backAt && !isDateKey(backAt)) return { ok: false, error: "invalid" };
  const note = String(input.note ?? "").trim().slice(0, 300) || null;

  const unit = await prisma.gearUnit.findUnique({ where: { id: input.unitId }, select: { id: true, condition: true } });
  if (!unit) return { ok: false, error: "invalid" };
  await prisma.$transaction(async (tx) => {
    await tx.gearUnit.update({ where: { id: unit.id }, data: { condition: input.condition, conditionNote: note, backAt } });
    await logUnitEvent(tx, unit.id, "CONDITION_CHANGED", user.id, { from: unit.condition, to: input.condition, note, backAt });
  });
  revalidateGearPages();
  return { ok: true };
}

// --- Issues ---

export type ReportResult = { ok: true; issueId: string } | { ok: false; error: "noPermission" | "invalid" | "descriptionRequired" };

/**
 * Files a report. Anyone who can see gear may. `markReturned` is the return
 * flow's "Report a problem": the unit is marked returned in the same
 * transaction (needs pick-up rights for that reservation).
 */
export async function reportGearIssueAction(input: {
  unitId: string;
  severity: (typeof SEVERITIES)[number];
  description: string;
  projectId?: string | null;
  reservationId?: string | null;
  markReturned?: boolean;
}): Promise<ReportResult> {
  const user = await requireUser();
  if (!canReportGearIssue(user)) return { ok: false, error: "noPermission" };
  const description = String(input.description ?? "").trim().slice(0, 2000);
  if (!description) return { ok: false, error: "descriptionRequired" };
  if (!SEVERITIES.includes(input.severity)) return { ok: false, error: "invalid" };
  const unit = await prisma.gearUnit.findUnique({ where: { id: input.unitId }, select: { id: true, condition: true } });
  if (!unit) return { ok: false, error: "invalid" };

  const reservation = input.reservationId ? await reservationForUser(user, input.reservationId) : null;
  if (reservation && reservation.unitId !== unit.id) return { ok: false, error: "invalid" };
  // A project only counts when the reporter can see it.
  const projectId =
    reservation?.projectId ??
    (input.projectId ? ((await prisma.project.findFirst({ where: { AND: [{ id: input.projectId }, projectWhereForUser(user)] }, select: { id: true } }))?.id ?? null) : null);
  const markReturned = Boolean(input.markReturned && reservation && !reservation.returnedAt && pickupAllowed(user, reservation));

  const issue = await prisma.$transaction(async (tx) => {
    const created = await tx.gearIssue.create({
      data: { unitId: unit.id, reportedById: user.id, severity: input.severity, description, projectId, reservationId: reservation?.id ?? null },
    });
    await logUnitEvent(tx, unit.id, "REPORTED", user.id, { issueId: created.id, severity: input.severity, reservationId: reservation?.id ?? null });
    if (markReturned && reservation) {
      await tx.gearReservation.update({
        where: { id: reservation.id },
        data: { returnedAt: new Date(), returnedById: user.id, returnCondition: unit.condition },
      });
      await logUnitEvent(tx, unit.id, "RETURNED", user.id, { reservationId: reservation.id, issueId: created.id, notPickedUp: !reservation.pickedUpAt });
    }
    return created;
  });
  if (reservation) revalidateReservation(reservation);
  else revalidateGearPages();
  return { ok: true, issueId: issue.id };
}

/** Moves an issue between statuses, with a resolution note and repair cost. Gear managers only. */
export async function updateGearIssueAction(input: {
  issueId: string;
  status: (typeof STATUSES)[number];
  resolutionNote?: string;
  repairCost?: number | null;
}): Promise<ConditionResult> {
  const user = await requireUser();
  if (!canManageGear(user)) return { ok: false, error: "noPermission" };
  if (!STATUSES.includes(input.status)) return { ok: false, error: "invalid" };
  const issue = await prisma.gearIssue.findUnique({ where: { id: input.issueId }, select: { id: true, unitId: true, status: true } });
  if (!issue) return { ok: false, error: "invalid" };
  const cost = input.repairCost == null || Number.isNaN(Number(input.repairCost)) ? null : Math.max(0, Math.round(Number(input.repairCost)));
  const closed = input.status === "RESOLVED" || input.status === "WONT_FIX";

  await prisma.$transaction(async (tx) => {
    await tx.gearIssue.update({
      where: { id: issue.id },
      data: {
        status: input.status,
        resolutionNote: String(input.resolutionNote ?? "").trim().slice(0, 2000) || null,
        repairCost: cost,
        resolvedAt: closed ? new Date() : null,
        resolvedById: closed ? user.id : null,
      },
    });
    if (input.status !== issue.status) {
      await logUnitEvent(tx, issue.unitId, closed ? "RESOLVED" : "NOTE", user.id, { issueId: issue.id, from: issue.status, to: input.status });
    }
  });
  revalidateGearPages();
  return { ok: true };
}

/** Deletes an issue and its photos. Gear managers only; asked to confirm in the UI. */
export async function deleteGearIssueAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageGear(user)) return;
  const id = String(formData.get("id") ?? "");
  const issue = await prisma.gearIssue.findUnique({ where: { id }, include: { photos: true } });
  if (!issue) return;
  await prisma.$transaction(async (tx) => {
    await tx.gearIssue.delete({ where: { id } });
    await logUnitEvent(tx, issue.unitId, "NOTE", user.id, { issueId: id, deleted: true });
  });
  await Promise.all(issue.photos.map((p) => deleteGearIssuePhoto(p.storedName)));
  revalidateGearPages();
}

// --- Reassign ---

export type ReassignResult = { ok: true; toNumber: number } | { ok: false; error: "noPermission" | "invalid" | "noneFree" };

/**
 * Moves one reserved unit's booking to another free unit of the same type
 * for the same days, never to the broken one. Runs the shared planner inside
 * a transaction; when nothing is free it says so and changes nothing.
 */
export async function reassignGearReservationAction(reservationId: string): Promise<ReassignResult> {
  const user = await requireUser();
  if (!canManageGear(user)) return { ok: false, error: "noPermission" };
  const r = await reservationForUser(user, reservationId);
  if (!r) return { ok: false, error: "invalid" };
  const now = today();
  try {
    const toNumber = await prisma.$transaction(async (tx) => {
      const units = await tx.gearUnit.findMany({
        where: { typeId: r.unit.typeId },
        select: { id: true, typeId: true, number: true, condition: true, backAt: true },
      });
      const bookings = await tx.gearReservation.findMany({
        where: { unitId: { in: units.map((u) => u.id) }, id: { not: r.id }, ...bookingsTouchingWhere(r.startDate, r.endDate) },
        select: { unitId: true, startDate: true, endDate: true, pickedUpAt: true, returnedAt: true },
      });
      const target = reassignTarget({ unitId: r.unit.id, startDate: r.startDate, endDate: r.endDate }, r.unit.typeId, units, bookings, now);
      if (!target) return null;
      await tx.gearReservation.update({ where: { id: r.id }, data: { unitId: target.id } });
      const data = { reservationId: r.id, fromUnit: r.unit.number, toUnit: target.number, startDate: r.startDate, endDate: r.endDate };
      await logUnitEvent(tx, r.unit.id, "REASSIGNED", user.id, data);
      await logUnitEvent(tx, target.id, "REASSIGNED", user.id, data);
      return target.number;
    });
    if (toNumber == null) return { ok: false, error: "noneFree" };
    revalidateReservation(r);
    return { ok: true, toNumber };
  } catch (e) {
    log.error("gear.reassign_failed", e);
    return { ok: false, error: "invalid" };
  }
}

// --- Pick-up and return ---

export type PickupBlock = { reservationId: string; reason: "unusable" | "window" | "already" | "returned" | "noAccess" };
export type PickupResult = { ok: true; done: number; blocked: PickupBlock[] };

/**
 * Marks reserved units as picked up. Blocked for a unit that can't be used
 * (damaged, in service, retired, lost: reassign it instead); allowed with a
 * warning in the UI for NEEDS_ATTENTION.
 */
export async function pickUpGearAction(reservationIds: string[]): Promise<PickupResult> {
  const user = await requireUser();
  const now = today();
  const blocked: PickupBlock[] = [];
  let done = 0;
  const touched = new Map<string, { project: { number: string; title: string } | null; batchId: string }>();
  for (const id of [...new Set(reservationIds)].slice(0, 200)) {
    const r = await reservationForUser(user, id);
    if (!r || !pickupAllowed(user, r)) {
      blocked.push({ reservationId: id, reason: "noAccess" });
      continue;
    }
    const reason = pickupBlockReason(r, now);
    if (reason) blocked.push({ reservationId: id, reason });
    else {
      await prisma.$transaction(async (tx) => {
        await tx.gearReservation.update({ where: { id }, data: { pickedUpAt: new Date(), pickedUpById: user.id } });
        await logUnitEvent(tx, r.unit.id, "PICKED_UP", user.id, { reservationId: id, condition: r.unit.condition });
      });
      done++;
      touched.set(r.batchId, r);
    }
  }
  for (const r of touched.values()) revalidateReservation(r);
  return { ok: true, done, blocked };
}

/** Marks reserved units as returned, recording their condition at that moment. A unit never picked up may be returned; history says so. */
export async function returnGearAction(reservationIds: string[]): Promise<PickupResult> {
  const user = await requireUser();
  const blocked: PickupBlock[] = [];
  let done = 0;
  const touched = new Map<string, { project: { number: string; title: string } | null; batchId: string }>();
  for (const id of [...new Set(reservationIds)].slice(0, 200)) {
    const r = await reservationForUser(user, id);
    if (!r || !pickupAllowed(user, r)) {
      blocked.push({ reservationId: id, reason: "noAccess" });
      continue;
    }
    if (r.returnedAt) {
      blocked.push({ reservationId: id, reason: "returned" });
      continue;
    }
    await prisma.$transaction(async (tx) => {
      await tx.gearReservation.update({ where: { id }, data: { returnedAt: new Date(), returnedById: user.id, returnCondition: r.unit.condition } });
      await logUnitEvent(tx, r.unit.id, "RETURNED", user.id, { reservationId: id, condition: r.unit.condition, notPickedUp: !r.pickedUpAt });
    });
    done++;
    touched.set(r.batchId, r);
  }
  for (const r of touched.values()) revalidateReservation(r);
  return { ok: true, done, blocked };
}

/** Undoes a pick-up (not while it's marked returned). Gear managers only; confirmed in the UI. */
export async function undoGearPickupAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageGear(user)) return;
  const r = await reservationForUser(user, String(formData.get("id") ?? ""));
  if (!r || !r.pickedUpAt || r.returnedAt) return;
  await prisma.$transaction(async (tx) => {
    await tx.gearReservation.update({ where: { id: r.id }, data: { pickedUpAt: null, pickedUpById: null } });
    await logUnitEvent(tx, r.unit.id, "PICKUP_UNDONE", user.id, { reservationId: r.id });
  });
  revalidateReservation(r);
}

/** Undoes a return. Gear managers only; confirmed in the UI. */
export async function undoGearReturnAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageGear(user)) return;
  const r = await reservationForUser(user, String(formData.get("id") ?? ""));
  if (!r || !r.returnedAt) return;
  await prisma.$transaction(async (tx) => {
    await tx.gearReservation.update({ where: { id: r.id }, data: { returnedAt: null, returnedById: null, returnCondition: null } });
    await logUnitEvent(tx, r.unit.id, "RETURN_UNDONE", user.id, { reservationId: r.id });
  });
  revalidateReservation(r);
}

// --- Scan ---

/** For the Gear search box: a pasted code or /g/ URL, or a tag id, to the unit's page. */
export async function resolveGearScanAction(input: string): Promise<{ href: string } | null> {
  await requireUser();
  const unit = await resolveGearScan(prisma, String(input ?? ""));
  return unit ? { href: `/g/${unit.code}` } : null;
}
