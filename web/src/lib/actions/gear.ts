"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageGear, projectWhereForUser } from "@/lib/authz";
import { DEFAULT_RATE_PERCENT, effectiveDayRate } from "@/lib/gear-pricing";
import { blockedRange, bookingBlocks, dayCount, freeUnits, isDateKey, planReservation, unitUsableFor, type PlanLine } from "@/lib/gear-reservations";
import { bookingsTouchingWhere } from "@/lib/gear-scope";
import { newGearCodes, unitRows } from "@/lib/gear-units";
import { pragueDateKey } from "@/lib/prague-date";

const gearTodayKey = () => pragueDateKey(new Date());
import { commitGearReservation, GearCollisionError, GearPlanRejected, replaceGearBatch } from "@/lib/gear-commit";
import { projectHref } from "@/lib/slug";
import { log } from "@/lib/log";

export type GearFormState = { error?: string; ok?: boolean };

/** Errors come back as codes; the client shows them from the dictionary. */
type ErrorCode =
  | "nameRequired"
  | "categoryRequired"
  | "categoryExists"
  | "categoryInUse"
  | "priceInvalid"
  | "rateInvalid"
  | "unitsInvalid"
  | "noPermission";

function fail(code: ErrorCode): GearFormState {
  return { error: code };
}

function revalidateGear() {
  revalidatePath("/gear", "layout");
}

/** A whole, non-negative number from a form field ("52 900" and "52900 Kč" both read as 52900), or null. */
function wholeNumber(raw: FormDataEntryValue | null) {
  const text = String(raw ?? "").replace(/[\s ]|Kč|CZK/gi, "").replace(",", ".");
  if (text === "") return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : NaN;
}

async function nextUnitNumber(typeId: string) {
  const used = new Set((await prisma.gearUnit.findMany({ where: { typeId }, select: { number: true } })).map((u) => u.number));
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

// --- Categories ---

export async function createGearCategoryAction(_prev: GearFormState, formData: FormData): Promise<GearFormState> {
  const user = await requireUser();
  if (!canManageGear(user)) return fail("noPermission");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return fail("nameRequired");
  if (await prisma.gearCategory.findUnique({ where: { name } })) return fail("categoryExists");
  const last = await prisma.gearCategory.aggregate({ _max: { sortOrder: true } });
  await prisma.gearCategory.create({ data: { name, sortOrder: (last._max.sortOrder ?? -1) + 1 } });
  revalidateGear();
  return { ok: true };
}

export async function renameGearCategoryAction(_prev: GearFormState, formData: FormData): Promise<GearFormState> {
  const user = await requireUser();
  if (!canManageGear(user)) return fail("noPermission");
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return fail("nameRequired");
  const clash = await prisma.gearCategory.findUnique({ where: { name } });
  if (clash && clash.id !== id) return fail("categoryExists");
  await prisma.gearCategory.update({ where: { id }, data: { name } });
  revalidateGear();
  return { ok: true };
}

export async function deleteGearCategoryAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageGear(user)) return;
  const id = String(formData.get("id") ?? "");
  if ((await prisma.gearType.count({ where: { categoryId: id } })) > 0) return;
  await prisma.gearCategory.delete({ where: { id } });
  revalidateGear();
}

// --- Types ---

function readTypeFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  const purchasePrice = wholeNumber(formData.get("purchasePrice")) ?? 0;
  const rateMode = formData.get("rateMode") === "CUSTOM" ? ("CUSTOM" as const) : ("AUTO" as const);
  const percentRaw = String(formData.get("ratePercent") ?? "").replace(",", ".").trim();
  const ratePercent = percentRaw === "" ? DEFAULT_RATE_PERCENT : Number(percentRaw);
  const customDayRate = wholeNumber(formData.get("customDayRate"));

  let error: ErrorCode | null = null;
  if (!name) error = "nameRequired";
  else if (!categoryId) error = "categoryRequired";
  else if (Number.isNaN(purchasePrice)) error = "priceInvalid";
  else if (!Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 100) error = "rateInvalid";
  else if (rateMode === "CUSTOM" && (customDayRate === null || Number.isNaN(customDayRate))) error = "rateInvalid";

  return {
    error,
    data: {
      name,
      categoryId,
      notes,
      purchasePrice,
      rateMode,
      ratePercent,
      customDayRate: customDayRate === null || Number.isNaN(customDayRate) ? null : customDayRate,
    },
  };
}

export async function createGearTypeAction(_prev: GearFormState, formData: FormData): Promise<GearFormState> {
  const user = await requireUser();
  if (!canManageGear(user)) return fail("noPermission");
  const { error, data } = readTypeFields(formData);
  if (error) return fail(error);
  const units = wholeNumber(formData.get("units")) ?? 1;
  if (Number.isNaN(units) || units > 100) return fail("unitsInvalid");
  if (!(await prisma.gearCategory.findUnique({ where: { id: data.categoryId } }))) return fail("categoryRequired");

  const type = await prisma.gearType.create({
    data: { ...data, units: { create: await unitRows(prisma, units) } },
  });
  revalidateGear();
  redirect(`/gear/${type.id}`);
}

export async function updateGearTypeAction(_prev: GearFormState, formData: FormData): Promise<GearFormState> {
  const user = await requireUser();
  if (!canManageGear(user)) return fail("noPermission");
  const id = String(formData.get("id") ?? "");
  const { error, data } = readTypeFields(formData);
  if (error) return fail(error);
  if (!(await prisma.gearCategory.findUnique({ where: { id: data.categoryId } }))) return fail("categoryRequired");
  await prisma.gearType.update({ where: { id }, data });
  revalidateGear();
  return { ok: true };
}

/** Blocked while any of its units has a reservation or a report; retiring the units is the way out. */
export async function deleteGearTypeAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageGear(user)) return;
  const id = String(formData.get("id") ?? "");
  if ((await prisma.gearReservation.count({ where: { unit: { typeId: id } } })) > 0) return;
  if ((await prisma.gearIssue.count({ where: { unit: { typeId: id } } })) > 0) return;
  await prisma.gearType.delete({ where: { id } });
  revalidateGear();
  redirect("/gear");
}

// --- Units ---

export async function addGearUnitAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageGear(user)) return;
  const typeId = String(formData.get("typeId") ?? "");
  if (!(await prisma.gearType.findUnique({ where: { id: typeId } }))) return;
  const [code] = await newGearCodes(prisma, 1);
  await prisma.gearUnit.create({ data: { typeId, number: await nextUnitNumber(typeId), code } });
  revalidateGear();
}

/** Only a unit that was never reserved or reported; one with history is retired instead. */
export async function deleteGearUnitAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageGear(user)) return;
  const id = String(formData.get("id") ?? "");
  if ((await prisma.gearReservation.count({ where: { unitId: id } })) > 0) return;
  if ((await prisma.gearIssue.count({ where: { unitId: id } })) > 0) return;
  await prisma.gearUnit.delete({ where: { id } });
  revalidateGear();
}

// --- Groups ---

export async function createGearGroupAction(_prev: GearFormState, formData: FormData): Promise<GearFormState> {
  const user = await requireUser();
  if (!canManageGear(user)) return fail("noPermission");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return fail("nameRequired");
  const group = await prisma.gearGroup.create({ data: { name, description: String(formData.get("description") ?? "").trim() } });
  revalidateGear();
  redirect(`/gear/groups?group=${group.id}`);
}

export async function updateGearGroupAction(_prev: GearFormState, formData: FormData): Promise<GearFormState> {
  const user = await requireUser();
  if (!canManageGear(user)) return fail("noPermission");
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return fail("nameRequired");
  await prisma.gearGroup.update({ where: { id }, data: { name, description: String(formData.get("description") ?? "").trim() } });
  revalidateGear();
  return { ok: true };
}

export async function deleteGearGroupAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageGear(user)) return;
  await prisma.gearGroup.delete({ where: { id: String(formData.get("id") ?? "") } });
  revalidateGear();
  redirect("/gear/groups");
}

/** Sets a type's quantity in a group; 0 removes it. */
export async function setGearGroupItemAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageGear(user)) return;
  const groupId = String(formData.get("groupId") ?? "");
  const typeId = String(formData.get("typeId") ?? "");
  const quantity = Math.min(100, Math.max(0, Math.floor(Number(formData.get("quantity")) || 0)));
  if (quantity === 0) {
    await prisma.gearGroupItem.deleteMany({ where: { groupId, typeId } });
  } else {
    await prisma.gearGroupItem.upsert({
      where: { groupId_typeId: { groupId, typeId } },
      create: { groupId, typeId, quantity },
      update: { quantity },
    });
  }
  revalidateGear();
}

// --- Reserving ---

export type ReserveInput = {
  lines: PlanLine[];
  startDate: string;
  endDate: string;
  /** When editing a reservation: leave its own bookings out and prefer the units it holds. */
  excludeBatchId?: string;
};

export type PreviewLine = {
  typeId: string;
  name: string;
  quantity: number;
  units: number[];
  shortBy: number;
  /** Units of this type that are taken in the range, with the booking that blocks each. */
  busy: { number: number; startDate: string; endDate: string }[];
  /** Other types in the same category with free units, offered when the line is short. */
  alternatives: { typeId: string; name: string; free: number }[];
  /** Picked units that need attention: still bookable, shown with a warning. */
  attention: number[];
  /** Units of this type out of use for the range (damaged, in service…). */
  unavailable: { number: number; condition: string; backAt: string | null }[];
};

export type PreviewResult =
  | { ok: true; days: number; lines: PreviewLine[]; wanted: number; got: number; cost: number }
  | { ok: false; error: "invalidRange" | "pickGear" | "noPermission" };

/** Merges repeated types and drops nonsense, so the plan and the commit see the same clean lines. */
function cleanLines(lines: PlanLine[]): PlanLine[] {
  const merged = new Map<string, number>();
  for (const l of Array.isArray(lines) ? lines : []) {
    const q = Math.floor(Number(l?.quantity));
    if (typeof l?.typeId !== "string" || !l.typeId || !(q > 0)) continue;
    merged.set(l.typeId, Math.min(100, (merged.get(l.typeId) ?? 0) + q));
  }
  return [...merged].map(([typeId, quantity]) => ({ typeId, quantity }));
}

function validRange(startDate: string, endDate: string) {
  return isDateKey(startDate) && isDateKey(endDate) && startDate <= endDate && dayCount(startDate, endDate) <= 366;
}

export async function previewGearReservationAction(input: ReserveInput): Promise<PreviewResult> {
  await requireUser(); // anyone may look; reserving is checked in reserveGearAction
  const lines = cleanLines(input.lines);
  if (!validRange(input.startDate, input.endDate)) return { ok: false, error: "invalidRange" };
  if (lines.length === 0) return { ok: false, error: "pickGear" };
  const range = { startDate: input.startDate, endDate: input.endDate };

  const types = await prisma.gearType.findMany({
    where: { id: { in: lines.map((l) => l.typeId) } },
    select: { id: true, name: true, categoryId: true, purchasePrice: true, rateMode: true, ratePercent: true, customDayRate: true },
  });
  const known = lines.filter((l) => types.some((t) => t.id === l.typeId));
  if (known.length === 0) return { ok: false, error: "pickGear" };

  // Units of the requested types and of their categories (for alternatives).
  const categoryIds = [...new Set(types.map((t) => t.categoryId))];
  const units = await prisma.gearUnit.findMany({
    where: { type: { categoryId: { in: categoryIds } }, condition: { notIn: ["RETIRED", "LOST"] } },
    select: { id: true, typeId: true, number: true, condition: true, backAt: true, type: { select: { name: true, categoryId: true } } },
  });
  const today = gearTodayKey();
  const editing = typeof input.excludeBatchId === "string" && input.excludeBatchId ? input.excludeBatchId : null;
  const bookings = await prisma.gearReservation.findMany({
    where: {
      unitId: { in: units.map((u) => u.id) },
      ...bookingsTouchingWhere(range.startDate, range.endDate),
      ...(editing ? { batchId: { not: editing } } : {}),
    },
    orderBy: { startDate: "asc" },
    select: { unitId: true, startDate: true, endDate: true, pickedUpAt: true, returnedAt: true },
  });
  const held = editing ? (await prisma.gearReservation.findMany({ where: { batchId: editing }, select: { unitId: true } })).map((r) => r.unitId) : [];

  const plan = planReservation(known, units, bookings, range, { prefer: new Set(held), today });
  const requested = new Set(known.map((l) => l.typeId));
  const days = dayCount(range.startDate, range.endDate);
  const rates = new Map(types.map((t) => [t.id, effectiveDayRate(t)]));

  const previewLines: PreviewLine[] = plan.map((line) => {
    const type = types.find((t) => t.id === line.typeId)!;
    const busy = units
      .filter((u) => u.typeId === line.typeId)
      .flatMap((u) => {
        const b = bookings.find((x) => x.unitId === u.id && bookingBlocks(x, range, today));
        if (b) return [{ number: u.number, ...blockedRange(b, today) }];
        return [];
      })
      .sort((a, b) => a.number - b.number);
    const alternatives =
      line.shortBy > 0
        ? [...new Set(units.filter((u) => u.type.categoryId === type.categoryId && !requested.has(u.typeId)).map((u) => u.typeId))]
            .map((typeId) => ({
              typeId,
              name: units.find((u) => u.typeId === typeId)!.type.name,
              free: freeUnits(typeId, units, bookings, range, today).length,
            }))
            .filter((a) => a.free > 0)
            .sort((a, b) => b.free - a.free)
            .slice(0, 2)
        : [];
    const attention = line.units.filter((pu) => units.find((u) => u.id === pu.id)?.condition === "NEEDS_ATTENTION").map((u) => u.number);
    const unavailable = units
      .filter((u) => u.typeId === line.typeId && !unitUsableFor(u, range))
      .map((u) => ({ number: u.number, condition: u.condition, backAt: u.backAt }))
      .sort((a, b) => a.number - b.number);
    return {
      typeId: line.typeId,
      name: type.name,
      quantity: line.quantity,
      units: line.units.map((u) => u.number),
      shortBy: line.shortBy,
      busy,
      alternatives,
      attention,
      unavailable,
    };
  });

  const wanted = plan.reduce((n, l) => n + l.quantity, 0);
  const got = plan.reduce((n, l) => n + l.units.length, 0);
  const cost = plan.reduce((sum, l) => sum + (rates.get(l.typeId) ?? 0) * l.units.length, 0) * days;
  return { ok: true, days, lines: previewLines, wanted, got, cost };
}

export type ReserveResult =
  | { ok: true; count: number; projectTitle: string | null; href: string }
  | { ok: false; error: "invalidRange" | "pickGear" | "pickProject" | "noPermission" | "errorNoAccess" | "errorShort" | "errorNothingFree" | "errorGeneric" };

export async function reserveGearAction(
  input: ReserveInput & { projectId: string | null; note?: string; groupId?: string | null; expectedUnits: number }
): Promise<ReserveResult> {
  const user = await requireUser();
  if (!canManageGear(user)) return { ok: false, error: "noPermission" };
  const lines = cleanLines(input.lines);
  if (!validRange(input.startDate, input.endDate)) return { ok: false, error: "invalidRange" };
  if (lines.length === 0) return { ok: false, error: "pickGear" };
  const note = String(input.note ?? "").trim().slice(0, 200);

  // A project is optional; when one is given the user must be able to see it.
  const project = input.projectId
    ? await prisma.project.findFirst({
        where: { AND: [{ id: input.projectId }, projectWhereForUser(user)] },
        select: { id: true, number: true, title: true },
      })
    : null;
  if (input.projectId && !project) return { ok: false, error: "errorNoAccess" };
  const groupId = input.groupId ? ((await prisma.gearGroup.findUnique({ where: { id: input.groupId }, select: { id: true } }))?.id ?? null) : null;

  try {
    const result = await prisma.$transaction((tx) =>
      commitGearReservation(tx, {
        lines,
        startDate: input.startDate,
        endDate: input.endDate,
        projectId: project?.id ?? null,
        note,
        groupId,
        userId: user.id,
        expectedUnits: Math.max(1, Math.floor(input.expectedUnits) || 0),
      })
    );
    if (!result.ok) return { ok: false, error: result.reason === "empty" ? "errorNothingFree" : "errorShort" };

    revalidateGear();
    if (project) revalidatePath(projectHref(project, "/gear"));
    return {
      ok: true,
      count: result.plan.reduce((n, l) => n + l.units.length, 0),
      projectTitle: project?.title ?? null,
      href: project ? projectHref(project, "/gear") : "/gear/reservations",
    };
  } catch (e) {
    if (e instanceof GearCollisionError) return { ok: false, error: "errorShort" };
    log.error("gear.reserve_failed", e);
    return { ok: false, error: "errorGeneric" };
  }
}

export type UpdateBatchResult =
  | { ok: true; count: number }
  | { ok: false; error: "invalidRange" | "pickGear" | "noPermission" | "errorNoAccess" | "errorShort" | "errorNothingFree" | "errorGeneric" | "errorMissing" };

/**
 * Edits a reservation (one batch): dates, project or none, note and items.
 * Re-planned in one transaction with its own old rows set aside, keeping the
 * units it held where they're still free. A plan short of what the person
 * agreed to rolls the whole edit back, so nothing is lost or silently cut.
 */
export async function updateGearBatchAction(
  input: ReserveInput & { batchId: string; projectId: string | null; note?: string; expectedUnits: number }
): Promise<UpdateBatchResult> {
  const user = await requireUser();
  if (!canManageGear(user)) return { ok: false, error: "noPermission" };
  const lines = cleanLines(input.lines);
  if (!validRange(input.startDate, input.endDate)) return { ok: false, error: "invalidRange" };
  if (lines.length === 0) return { ok: false, error: "pickGear" };

  const current = await prisma.gearReservation.findFirst({
    where: { batchId: String(input.batchId ?? "") },
    select: { projectId: true, project: { select: { number: true, title: true } } },
  });
  if (!current) return { ok: false, error: "errorMissing" };
  const visible = async (id: string) =>
    prisma.project.findFirst({ where: { AND: [{ id }, projectWhereForUser(user)] }, select: { id: true, number: true, title: true } });
  if (current.projectId && !(await visible(current.projectId))) return { ok: false, error: "errorNoAccess" };
  const project = input.projectId ? await visible(input.projectId) : null;
  if (input.projectId && !project) return { ok: false, error: "errorNoAccess" };

  try {
    const result = await prisma.$transaction((tx) =>
      replaceGearBatch(tx, input.batchId, {
        lines,
        startDate: input.startDate,
        endDate: input.endDate,
        projectId: project?.id ?? null,
        note: String(input.note ?? "").trim().slice(0, 200),
        userId: user.id,
        expectedUnits: Math.max(1, Math.floor(input.expectedUnits) || 0),
      })
    );
    if (!result.ok) return { ok: false, error: "errorMissing" };
    revalidateGear();
    if (current.project) revalidatePath(projectHref(current.project, "/gear"));
    if (project) revalidatePath(projectHref(project, "/gear"));
    return { ok: true, count: result.plan.reduce((n, l) => n + l.units.length, 0) };
  } catch (e) {
    if (e instanceof GearPlanRejected) return { ok: false, error: !e.result.ok && e.result.reason === "empty" ? "errorNothingFree" : "errorShort" };
    if (e instanceof GearCollisionError) return { ok: false, error: "errorShort" };
    log.error("gear.update_failed", e);
    return { ok: false, error: "errorGeneric" };
  }
}

/** Releases everything reserved in one click. Needs gear rights and, for a project's batch, sight of the project. */
export async function releaseGearBatchAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageGear(user)) return;
  const batchId = String(formData.get("batchId") ?? "");
  const first = await prisma.gearReservation.findFirst({
    where: { batchId },
    select: { projectId: true, project: { select: { number: true, title: true } } },
  });
  if (!first) return;
  if (first.projectId && !(await prisma.project.findFirst({ where: { AND: [{ id: first.projectId }, projectWhereForUser(user)] }, select: { id: true } }))) return;
  await prisma.gearReservation.deleteMany({ where: { batchId } });
  revalidateGear();
  if (first.project) revalidatePath(projectHref(first.project, "/gear"));
}
