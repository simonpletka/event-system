import { prisma } from "@/lib/prisma";
import { projectWhereForUser, type SessionUser } from "@/lib/authz";
import { effectiveDayRate } from "@/lib/gear-pricing";
import { dayCount, freePerDay, freeUnits } from "@/lib/gear-reservations";
import type { Prisma } from "@/generated/prisma/client";
import { pragueDateKey, shiftDateKey } from "@/lib/prague-date";

/** Today in Prague, whatever the server's timezone. */
export function gearToday() {
  return pragueDateKey(new Date());
}

/** The 14 day keys of a window starting at `from`. */
export function windowDays(from: string, length = 14) {
  return Array.from({ length }, (_, i) => shiftDateKey(from, i));
}

const pricingSelect = { purchasePrice: true, rateMode: true, ratePercent: true, customDayRate: true } as const;

export async function getGearCategories() {
  const categories = await prisma.gearCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { types: true } } },
  });
  return categories.map((c) => ({ id: c.id, name: c.name, typeCount: c._count.types }));
}

export async function getGearTypeCount() {
  return prisma.gearType.count();
}

/** Every type with its unit count, free-today count and derived day rate, for the Catalog. */
export async function getGearCatalog() {
  const today = gearToday();
  const [categories, types, todays] = await Promise.all([
    getGearCategories(),
    prisma.gearType.findMany({
      orderBy: { name: "asc" },
      include: { units: { where: { active: true }, select: { id: true, typeId: true, number: true, active: true } } },
    }),
    prisma.gearReservation.findMany({
      where: { startDate: { lte: today }, endDate: { gte: today } },
      select: { unitId: true, startDate: true, endDate: true },
    }),
  ]);
  const range = { startDate: today, endDate: today };
  const rows = types.map((t) => ({
    id: t.id,
    name: t.name,
    categoryId: t.categoryId,
    units: t.units.length,
    freeToday: freeUnits(t.id, t.units, todays, range).length,
    purchasePrice: t.purchasePrice,
    rateMode: t.rateMode,
    ratePercent: t.ratePercent,
    dayRate: effectiveDayRate(t),
  }));
  return { categories, rows };
}

/** Lightweight list for pickers (group editor, reserve panel). */
export async function getGearTypeOptions() {
  const types = await prisma.gearType.findMany({
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    select: { id: true, name: true, category: { select: { name: true } }, ...pricingSelect, _count: { select: { units: { where: { active: true } } } } },
  });
  return types.map((t) => ({ id: t.id, name: t.name, category: t.category.name, dayRate: effectiveDayRate(t), units: t._count.units }));
}

export type GearTypeOption = Awaited<ReturnType<typeof getGearTypeOptions>>[number];

/** One type with its units, each unit's next 14 days and its next booking, and the groups it's in. */
export async function getGearTypeDetail(id: string) {
  const type = await prisma.gearType.findUnique({
    where: { id },
    include: {
      category: true,
      units: { orderBy: { number: "asc" }, include: { _count: { select: { reservations: true } } } },
      groupItems: { include: { group: { select: { id: true, name: true } } }, orderBy: { group: { name: "asc" } } },
    },
  });
  if (!type) return null;

  const today = gearToday();
  const days = windowDays(today);
  const last = days[days.length - 1];
  const bookings = await prisma.gearReservation.findMany({
    where: { unitId: { in: type.units.map((u) => u.id) }, endDate: { gte: today } },
    orderBy: { startDate: "asc" },
    select: { unitId: true, startDate: true, endDate: true, note: true, project: { select: { title: true, number: true } } },
  });

  const units = type.units.map((u) => {
    const own = bookings.filter((b) => b.unitId === u.id);
    const next = own[0] ?? null;
    return {
      id: u.id,
      number: u.number,
      label: u.label,
      active: u.active,
      hasReservations: u._count.reservations > 0,
      reservedToday: own.some((b) => b.startDate <= today && today <= b.endDate),
      days: days.map((day) => own.some((b) => b.startDate <= day && day <= b.endDate && b.startDate <= last)),
      next: next ? { startDate: next.startDate, endDate: next.endDate, project: next.project?.title ?? null, note: next.note } : null,
    };
  });

  return {
    id: type.id,
    name: type.name,
    categoryId: type.categoryId,
    categoryName: type.category.name,
    notes: type.notes,
    purchasePrice: type.purchasePrice,
    rateMode: type.rateMode,
    ratePercent: type.ratePercent,
    customDayRate: type.customDayRate,
    dayRate: effectiveDayRate(type),
    today,
    days,
    units,
    hasReservations: units.some((u) => u.hasReservations),
    groups: type.groupItems.map((gi) => ({ id: gi.group.id, name: gi.group.name, quantity: gi.quantity })),
  };
}

/** Every group with its items, priced per day. */
export async function getGearGroups() {
  const groups = await prisma.gearGroup.findMany({
    orderBy: { name: "asc" },
    include: {
      items: {
        include: { type: { select: { id: true, name: true, category: { select: { name: true, sortOrder: true } }, ...pricingSelect } } },
      },
    },
  });
  return groups.map((g) => {
    const items = g.items
      .map((i) => ({
        typeId: i.typeId,
        name: i.type.name,
        category: i.type.category.name,
        categoryOrder: i.type.category.sortOrder,
        quantity: i.quantity,
        dayRate: effectiveDayRate(i.type),
      }))
      .sort((a, b) => a.categoryOrder - b.categoryOrder || a.name.localeCompare(b.name));
    return {
      id: g.id,
      name: g.name,
      description: g.description,
      items,
      itemCount: items.reduce((n, i) => n + i.quantity, 0),
      perDay: items.reduce((n, i) => n + i.dayRate * i.quantity, 0),
    };
  });
}

export type GearGroupView = Awaited<ReturnType<typeof getGearGroups>>[number];

/** Free units per type per day for a 14-day window, plus each unit's bookings in it. */
export async function getGearAvailability(from: string) {
  const days = windowDays(from);
  const to = days[days.length - 1];
  const [categories, types, bookings] = await Promise.all([
    getGearCategories(),
    prisma.gearType.findMany({
      orderBy: { name: "asc" },
      include: { units: { where: { active: true }, orderBy: { number: "asc" }, select: { id: true, typeId: true, number: true, active: true } } },
    }),
    prisma.gearReservation.findMany({
      where: { startDate: { lte: to }, endDate: { gte: from }, unit: { active: true } },
      select: { unitId: true, startDate: true, endDate: true, batchId: true, note: true, project: { select: { title: true, number: true } } },
    }),
  ]);
  const rows = types.map((t) => ({
    id: t.id,
    name: t.name,
    categoryId: t.categoryId,
    total: t.units.length,
    free: freePerDay(t.id, t.units, bookings, days),
    units: t.units.map((u) => ({
      id: u.id,
      number: u.number,
      bars: bookings
        .filter((b) => b.unitId === u.id)
        .map((b) => ({
          // Clipped to the window, as indexes into `days`.
          from: Math.max(0, days.indexOf(b.startDate < from ? from : b.startDate)),
          to: days.indexOf(b.endDate > to ? to : b.endDate),
          project: b.project?.title ?? null,
          number: b.project?.number ?? "",
          note: b.note,
        }))
        .sort((a, b) => a.from - b.from),
    })),
  }));
  return { days, categories, rows };
}

/** Projects the user may reserve gear for: visible to them and not closed or cancelled. */
export async function getReservableProjects(user: SessionUser) {
  return prisma.project.findMany({
    where: { AND: [projectWhereForUser(user), { status: { notIn: ["CLOSED", "CANCELLED"] } }] },
    orderBy: { startDate: "asc" },
    select: { id: true, title: true, companyName: true },
  });
}

/**
 * Reservations as batches (everything reserved in one click), oldest start
 * first. Used by a project's Gear tab and by the Reservations tab, which also
 * shows bookings made for no project.
 */
export async function getGearBatches(where: Prisma.GearReservationWhereInput) {
  const rows = await prisma.gearReservation.findMany({
    where,
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
    include: {
      unit: { select: { number: true, type: { select: { id: true, name: true, ...pricingSelect } } } },
      group: { select: { name: true } },
      project: { select: { number: true, title: true } },
      createdBy: { select: { name: true } },
    },
  });
  type Line = { typeId: string; name: string; dayRate: number; numbers: number[] };
  const batches = new Map<
    string,
    {
      batchId: string;
      startDate: string;
      endDate: string;
      groupName: string | null;
      project: { number: string; title: string } | null;
      note: string;
      createdBy: string | null;
      lines: Map<string, Line>;
    }
  >();
  for (const r of rows) {
    let batch = batches.get(r.batchId);
    if (!batch) {
      batch = {
        batchId: r.batchId,
        startDate: r.startDate,
        endDate: r.endDate,
        groupName: r.group?.name ?? null,
        project: r.project,
        note: r.note,
        createdBy: r.createdBy?.name ?? null,
        lines: new Map(),
      };
      batches.set(r.batchId, batch);
    }
    const t = r.unit.type;
    const line = batch.lines.get(t.id) ?? { typeId: t.id, name: t.name, dayRate: effectiveDayRate(t), numbers: [] };
    line.numbers.push(r.unit.number);
    batch.lines.set(t.id, line);
  }
  return [...batches.values()].map((b) => {
    const lines = [...b.lines.values()].map((l) => ({ ...l, numbers: l.numbers.sort((x, y) => x - y) }));
    const days = dayCount(b.startDate, b.endDate);
    const count = lines.reduce((n, l) => n + l.numbers.length, 0);
    return { ...b, lines, days, count, cost: lines.reduce((sum, l) => sum + l.dayRate * l.numbers.length, 0) * days };
  });
}

export type GearBatch = Awaited<ReturnType<typeof getGearBatches>>[number];

/** A project's gear at a glance, for its Overview: items booked and the span they cover. */
export async function getProjectGearSummary(projectId: string) {
  const rows = await prisma.gearReservation.findMany({ where: { projectId }, select: { startDate: true, endDate: true } });
  if (rows.length === 0) return null;
  return {
    count: rows.length,
    startDate: rows.reduce((m, r) => (r.startDate < m ? r.startDate : m), rows[0].startDate),
    endDate: rows.reduce((m, r) => (r.endDate > m ? r.endDate : m), rows[0].endDate),
  };
}
