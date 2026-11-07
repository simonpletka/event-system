"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canEditProject, canManageCompanySettings } from "@/lib/authz";
import { locateAddresses } from "@/lib/address-search";
import { estimateRoute, isGoogleRoutingConfigured, nextPredictableDeparture, pragueInstant, type RouteEstimate } from "@/lib/routing";
import { buildSchedule, driveWithBuffer, parseClock } from "@/lib/trip-schedule";
import { projectHref } from "@/lib/slug";
import type { FuelType } from "@/generated/prisma/enums";

export type TripFormState = { error?: string };
export type TravelFormState = { error?: string; success?: boolean };

const MAX_STOPS = 12;
const PRAGUE = { lat: 50.08, lon: 14.43 };

type StopPayload = {
  label: string;
  address: string;
  lat: number | null;
  lng: number | null;
  arrive: string;
  depart: string;
  stay: string;
  manual: string;
  splitRental: boolean;
  note: string;
};

function parseMinutes(value: string): number | null {
  const n = parseInt(value, 10);
  return Number.isNaN(n) || n < 0 ? null : n;
}

/** Accepts both "5,8" and "5.8" — a Czech keyboard produces the former. */
function parseDecimal(value: FormDataEntryValue | null): number {
  return parseFloat(String(value ?? "").replace(",", "."));
}

async function loadEditableProject(projectId: string) {
  const user = await requireUser();
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { members: true } });
  if (!project) return null;
  if (!canEditProject(user, { ownerId: project.ownerId, memberIds: project.members.map((m) => m.userId) })) return null;
  return { user, project };
}

type StopRow = {
  lat: number | null;
  lng: number | null;
  arriveMin: number | null;
  departMin: number | null;
  stayMinutes: number | null;
  manualMinutes: number | null;
};

function hasPosition(s: StopRow): s is StopRow & { lat: number; lng: number } {
  return s.lat != null && s.lng != null;
}

/**
 * Two passes: traffic depends on when each leg is driven, and when it's
 * driven depends on the other legs. The first pass gets a timetable, the
 * second re-asks Google with each leg's real departure. OSM ignores departure
 * time, so its first answer is final.
 */
async function estimateLegs(date: string, bufferMinutes: number, stops: StopRow[]) {
  const ask = (i: number, departure: Date | null): Promise<RouteEstimate | null> => {
    const from = stops[i - 1];
    const to = stops[i];
    return i > 0 && hasPosition(from) && hasPosition(to) ? estimateRoute(from, to, departure) : Promise.resolve(null);
  };

  const first = await Promise.all(stops.map((_, i) => ask(i, null)));
  if (!isGoogleRoutingConfigured()) return first;

  const schedule = buildSchedule(
    stops.map((s, i) => ({
      arriveMin: s.arriveMin,
      departMin: s.departMin,
      stayMinutes: s.stayMinutes,
      driveMinutes: driveWithBuffer({ manualMinutes: s.manualMinutes, legMinutes: first[i]?.minutes ?? null }, bufferMinutes),
    }))
  );
  return Promise.all(
    stops.map(async (_, i) => {
      const depart = i > 0 ? schedule.stops[i - 1].depart : null;
      if (depart == null) return first[i];
      return (await ask(i, nextPredictableDeparture(pragueInstant(date, depart)))) ?? first[i];
    })
  );
}

export async function saveTripAction(_prev: TripFormState, formData: FormData): Promise<TripFormState> {
  const projectId = String(formData.get("projectId"));
  const ctx = await loadEditableProject(projectId);
  if (!ctx) return { error: "You don't have permission to edit this project." };

  const tripId = String(formData.get("tripId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  const bufferMinutes = parseMinutes(String(formData.get("bufferMinutes") ?? "")) ?? 0;
  if (!title) return { error: "A trip needs a name." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Pick a date." };

  let payload: StopPayload[];
  try {
    payload = JSON.parse(String(formData.get("stops") ?? "[]"));
  } catch {
    return { error: "Couldn't read the stops." };
  }
  const entered = payload.filter((s) => s.address.trim());
  if (entered.length < 2) return { error: "A trip needs at least two stops with an address." };
  if (entered.length > MAX_STOPS) return { error: `A trip can have at most ${MAX_STOPS} stops.` };

  if (tripId) {
    const existing = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!existing || existing.projectId !== projectId) return { error: "Trip not found." };
  }

  // A typed address has no coordinates until it's looked up; one picked from
  // the suggestions already carries them.
  const located = await locateAddresses(
    entered.filter((s) => s.lat == null || s.lng == null).map((s) => s.address.trim()),
    PRAGUE
  );
  const stops = entered.map((s, i) => {
    const match = s.lat == null || s.lng == null ? located.get(s.address.trim()) : null;
    return {
      label: s.label.trim(),
      address: s.address.trim(),
      lat: match?.lat ?? s.lat,
      lng: match?.lon ?? s.lng,
      arriveMin: parseClock(s.arrive),
      departMin: parseClock(s.depart),
      stayMinutes: parseMinutes(s.stay),
      manualMinutes: parseMinutes(s.manual),
      // Only a stop in the middle can split: the ends already start and stop the rental.
      splitRental: Boolean(s.splitRental) && i > 0 && i < entered.length - 1,
      note: s.note.trim(),
    };
  });

  const legs = await estimateLegs(date, bufferMinutes, stops);
  const stopRows = stops.map((s, i) => ({
    ...s,
    position: i,
    legMinutes: legs[i]?.minutes ?? null,
    legKm: legs[i]?.km ?? null,
    legSource: legs[i]?.source ?? null,
    legPolyline: legs[i]?.polyline ?? null,
  }));

  const fields = { title, date, bufferMinutes, routesUpdatedAt: new Date() };
  await prisma.$transaction(async (tx) => {
    if (tripId) {
      await tx.tripStop.deleteMany({ where: { tripId } });
      await tx.trip.update({ where: { id: tripId }, data: { ...fields, stops: { create: stopRows } } });
    } else {
      await tx.trip.create({ data: { ...fields, projectId, createdById: ctx.user.id, stops: { create: stopRows } } });
    }
  });

  const href = projectHref(ctx.project, "/trips");
  revalidatePath(href);
  redirect(href);
}

export async function deleteTripAction(formData: FormData) {
  const trip = await prisma.trip.findUnique({ where: { id: String(formData.get("tripId")) } });
  if (!trip) return;
  const ctx = await loadEditableProject(trip.projectId);
  if (!ctx) return;
  await prisma.trip.delete({ where: { id: trip.id } });
  revalidatePath(projectHref(ctx.project, "/trips"));
}

export async function saveVehicleAction(_prev: TravelFormState, formData: FormData): Promise<TravelFormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const fuelType: FuelType = formData.get("fuelType") === "PETROL" ? "PETROL" : "DIESEL";
  const consumptionPer100Km = parseDecimal(formData.get("consumptionPer100Km"));
  const fuelPricePerLitre = parseDecimal(formData.get("fuelPricePerLitre"));
  const extraCostPerKm = parseDecimal(formData.get("extraCostPerKm")) || 0;
  if (!name) return { error: "Name the car." };
  if (!(consumptionPer100Km > 0) || !(fuelPricePerLitre > 0)) return { error: "Enter consumption and fuel price." };

  const data = { name, fuelType, consumptionPer100Km, fuelPricePerLitre, extraCostPerKm };
  if (id) {
    await prisma.vehicle.updateMany({ where: { id, ownerId: user.id }, data });
  } else {
    await prisma.vehicle.create({ data: { ...data, ownerId: user.id } });
  }
  revalidatePath("/settings");
  return { success: true };
}

export async function deleteVehicleAction(formData: FormData) {
  const user = await requireUser();
  await prisma.vehicle.deleteMany({ where: { id: String(formData.get("id")), ownerId: user.id } });
  revalidatePath("/settings");
}

export async function saveCarsharingPlanAction(_prev: TravelFormState, formData: FormData): Promise<TravelFormState> {
  const user = await requireUser();
  if (!canManageCompanySettings(user)) return { error: "You don't have permission to change tariffs." };

  const id = String(formData.get("id") ?? "");
  const provider = String(formData.get("provider") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!provider || !name) return { error: "Enter the operator and tariff name." };

  const hours = parseDecimal(formData.get("packageHours"));
  const data = {
    provider,
    name,
    carClass: String(formData.get("carClass") ?? "").trim(),
    packagePrice: parseDecimal(formData.get("packagePrice")) || 0,
    packageMinutes: hours > 0 ? Math.round(hours * 60) : null,
    packageKm: parseInt(String(formData.get("packageKm") ?? ""), 10) || 0,
    minuteRate: parseDecimal(formData.get("minuteRate")) || 0,
    kmRate: parseDecimal(formData.get("kmRate")) || 0,
    weekendOnly: formData.get("weekendOnly") === "on",
    verified: formData.get("verified") === "on",
    active: formData.get("active") === "on",
  };
  if (id) {
    await prisma.carsharingPlan.update({ where: { id }, data });
  } else {
    await prisma.carsharingPlan.create({ data: { ...data, sortOrder: 1000 } });
  }
  revalidatePath("/settings");
  return { success: true };
}

export async function deleteCarsharingPlanAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageCompanySettings(user)) return;
  await prisma.carsharingPlan.deleteMany({ where: { id: String(formData.get("id")) } });
  revalidatePath("/settings");
}
