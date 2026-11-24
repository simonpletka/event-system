import { prisma } from "@/lib/prisma";
import { projectWhereForUser, type SessionUser } from "@/lib/authz";
import { isOverdue, unitUsableFor, unitUsableOn } from "@/lib/gear-reservations";
import { pickupWindowOpen } from "@/lib/gear-events";
import { gearToday } from "@/lib/queries/gear";
import type { Prisma } from "@/generated/prisma/client";

const projectSelect = { id: true, number: true, title: true, ownerId: true, members: { select: { userId: true } } } as const;

/** What a reservation row shows wherever pick-up/return happens. */
const reservationRowSelect = {
  id: true,
  batchId: true,
  startDate: true,
  endDate: true,
  note: true,
  pickedUpAt: true,
  returnedAt: true,
  returnCondition: true,
  pickedUpBy: { select: { name: true } },
  returnedBy: { select: { name: true } },
  project: { select: projectSelect },
  unit: { select: { id: true, number: true, code: true, condition: true, backAt: true, type: { select: { id: true, name: true } } } },
} as const satisfies Prisma.GearReservationSelect;

type ReservationRow = Prisma.GearReservationGetPayload<{ select: typeof reservationRowSelect }>;

function toRow(r: ReservationRow, today: string) {
  return {
    id: r.id,
    batchId: r.batchId,
    startDate: r.startDate,
    endDate: r.endDate,
    note: r.note,
    pickedUpAt: r.pickedUpAt?.toISOString() ?? null,
    pickedUpBy: r.pickedUpBy?.name ?? null,
    returnedAt: r.returnedAt?.toISOString() ?? null,
    returnedBy: r.returnedBy?.name ?? null,
    project: r.project ? { id: r.project.id, number: r.project.number, title: r.project.title } : null,
    projectAccess: r.project ? { ownerId: r.project.ownerId, memberIds: r.project.members.map((m) => m.userId) } : null,
    unit: { id: r.unit.id, number: r.unit.number, code: r.unit.code, condition: r.unit.condition, backAt: r.unit.backAt, typeId: r.unit.type.id, typeName: r.unit.type.name },
    overdue: isOverdue({ ...r, unitId: r.unit.id }, today),
    pickupOpen: pickupWindowOpen(r, today),
    unitUsable: unitUsableOn(r.unit, today),
  };
}

export type GearReservationRow = ReturnType<typeof toRow>;

/** Reservations the user may see: no project, or a project visible to them. */
function visibleReservations(user: SessionUser): Prisma.GearReservationWhereInput {
  return { OR: [{ projectId: null }, { project: { is: projectWhereForUser(user) } }] };
}

/** Everything the /g/<code> page shows for one unit. */
export async function getGearUnitPage(user: SessionUser, code: string) {
  const unit = await prisma.gearUnit.findUnique({
    where: { code },
    include: {
      type: { select: { id: true, name: true, category: { select: { name: true } } } },
      issues: {
        orderBy: { reportedAt: "desc" },
        include: { photos: { select: { id: true, originalName: true } }, reportedBy: { select: { name: true } }, project: { select: { number: true, title: true } } },
      },
      events: { orderBy: { at: "desc" }, take: 40, include: { actor: { select: { name: true } } } },
    },
  });
  if (!unit) return null;
  const today = gearToday();
  const reservations = await prisma.gearReservation.findMany({
    where: {
      AND: [
        { unitId: unit.id },
        visibleReservations(user),
        { OR: [{ endDate: { gte: today } }, { pickedUpAt: { not: null }, returnedAt: null }] },
      ],
    },
    orderBy: { startDate: "asc" },
    select: reservationRowSelect,
  });
  const rows = reservations.map((r) => toRow(r, today));
  const current = rows.find((r) => r.overdue || (r.pickedUpAt && !r.returnedAt) || r.pickupOpen) ?? null;
  // Bookings the unit can't serve as things stand: listed so they can be reassigned.
  const affected = rows.filter((r) => !r.returnedAt && !unitUsableFor(unit, { startDate: r.startDate > today ? r.startDate : today, endDate: r.endDate }));

  return {
    unit: {
      id: unit.id,
      number: unit.number,
      code: unit.code,
      tagUid: unit.tagUid,
      condition: unit.condition,
      conditionNote: unit.conditionNote,
      backAt: unit.backAt,
      typeId: unit.type.id,
      typeName: unit.type.name,
      category: unit.type.category.name,
    },
    today,
    current,
    upcoming: rows.filter((r) => r !== current && !r.returnedAt),
    affected,
    issues: unit.issues.map((i) => ({
      id: i.id,
      severity: i.severity,
      status: i.status,
      description: i.description,
      reportedAt: i.reportedAt.toISOString(),
      reportedBy: i.reportedBy?.name ?? null,
      project: i.project,
      resolutionNote: i.resolutionNote,
      repairCost: i.repairCost,
      photos: i.photos,
    })),
    events: unit.events.map((e) => ({ id: e.id, type: e.type, at: e.at.toISOString(), actor: e.actor?.name ?? null, data: safeJson(e.data) })),
  };
}

function safeJson(text: string): Record<string, unknown> {
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

export type GearUnitPage = NonNullable<Awaited<ReturnType<typeof getGearUnitPage>>>;

export type IssueFilter = { status: "open" | "all" | "OPEN" | "IN_SERVICE" | "RESOLVED" | "WONT_FIX"; severity: "all" | "MINOR" | "MAJOR" | "UNUSABLE" };

/** Issues across all gear, newest first. "open" means OPEN or IN_SERVICE. */
export async function getGearIssues(filter: IssueFilter) {
  const where: Prisma.GearIssueWhereInput = {
    ...(filter.status === "open" ? { status: { in: ["OPEN", "IN_SERVICE"] } } : filter.status === "all" ? {} : { status: filter.status }),
    ...(filter.severity === "all" ? {} : { severity: filter.severity }),
  };
  const issues = await prisma.gearIssue.findMany({
    where,
    orderBy: { reportedAt: "desc" },
    take: 300,
    include: {
      unit: { select: { number: true, code: true, condition: true, type: { select: { name: true } } } },
      reportedBy: { select: { name: true } },
      project: { select: { number: true, title: true } },
      _count: { select: { photos: true } },
    },
  });
  return issues.map((i) => ({
    id: i.id,
    severity: i.severity,
    status: i.status,
    description: i.description,
    reportedAt: i.reportedAt.toISOString(),
    reportedBy: i.reportedBy?.name ?? null,
    project: i.project,
    photos: i._count.photos,
    repairCost: i.repairCost,
    unit: { number: i.unit.number, code: i.unit.code, condition: i.unit.condition, typeName: i.unit.type.name },
  }));
}

export async function getOpenGearIssueCount() {
  return prisma.gearIssue.count({ where: { status: { in: ["OPEN", "IN_SERVICE"] } } });
}

/**
 * The Catalog's "Needs attention" box: bookings on units that can't serve
 * them (damaged, in service over those days, lost, retired), and units
 * picked up and not returned past their end date.
 */
export async function getGearAttention(user: SessionUser) {
  const today = gearToday();
  const [onBroken, overdue] = await Promise.all([
    prisma.gearReservation.findMany({
      where: {
        AND: [
          visibleReservations(user),
          { endDate: { gte: today }, returnedAt: null },
          { unit: { condition: { in: ["DAMAGED", "IN_SERVICE", "RETIRED", "LOST"] } } },
        ],
      },
      orderBy: { startDate: "asc" },
      select: reservationRowSelect,
    }),
    prisma.gearReservation.findMany({
      where: { AND: [visibleReservations(user), { endDate: { lt: today }, pickedUpAt: { not: null }, returnedAt: null }] },
      orderBy: { endDate: "asc" },
      select: reservationRowSelect,
    }),
  ]);
  const affected = onBroken
    .filter((r) => !unitUsableFor(r.unit, { startDate: r.startDate > today ? r.startDate : today, endDate: r.endDate }))
    .map((r) => toRow(r, today));
  return { affected, overdue: overdue.map((r) => toRow(r, today)) };
}

/** One reservation (batch) as a pick-up checklist. */
export async function getGearBatchChecklist(user: SessionUser, batchId: string) {
  const today = gearToday();
  const rows = await prisma.gearReservation.findMany({
    where: { AND: [{ batchId }, visibleReservations(user)] },
    orderBy: [{ unit: { type: { name: "asc" } } }, { unit: { number: "asc" } }],
    select: { ...reservationRowSelect, group: { select: { name: true } } },
  });
  if (rows.length === 0) return null;
  const first = rows[0];
  return {
    batchId,
    startDate: first.startDate,
    endDate: first.endDate,
    note: first.note,
    groupName: first.group?.name ?? null,
    project: first.project ? { id: first.project.id, number: first.project.number, title: first.project.title } : null,
    projectAccess: first.project ? { ownerId: first.project.ownerId, memberIds: first.project.members.map((m) => m.userId) } : null,
    rows: rows.map((r) => toRow(r, today)),
  };
}

export type GearBatchChecklist = NonNullable<Awaited<ReturnType<typeof getGearBatchChecklist>>>;

/** Labels: units to print, by id or by type, active ones only. */
export async function getGearLabelUnits(filter: { unitIds?: string[]; typeId?: string }) {
  const where: Prisma.GearUnitWhereInput = {
    condition: { not: "RETIRED" },
    ...(filter.unitIds?.length ? { id: { in: filter.unitIds } } : filter.typeId ? { typeId: filter.typeId } : { id: "__none__" }),
  };
  const units = await prisma.gearUnit.findMany({
    where,
    orderBy: [{ type: { name: "asc" } }, { number: "asc" }],
    select: { id: true, number: true, code: true, type: { select: { name: true } } },
  });
  return units.map((u) => ({ id: u.id, number: u.number, code: u.code, typeName: u.type.name }));
}

/** A project's reservations as pick-up rows, by batch. */
export async function getProjectChecklistRows(projectId: string) {
  const today = gearToday();
  const rows = await prisma.gearReservation.findMany({
    where: { projectId },
    orderBy: [{ unit: { type: { name: "asc" } } }, { unit: { number: "asc" } }],
    select: reservationRowSelect,
  });
  const byBatch = new Map<string, GearReservationRow[]>();
  for (const r of rows) {
    const row = toRow(r, today);
    byBatch.set(r.batchId, [...(byBatch.get(r.batchId) ?? []), row]);
  }
  return byBatch;
}
