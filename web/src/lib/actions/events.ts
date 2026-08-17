"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, canEditEvent, canCreateEvent, isAdmin } from "@/lib/authz";
import { resolveClientId } from "@/lib/actions/clients";
import type { EventStatus } from "@/generated/prisma/enums";

export type EventFormState = { error?: string };

function parseVenues(formData: FormData) {
  const names = formData.getAll("venueName") as string[];
  const addresses = formData.getAll("venueAddress") as string[];
  const notes = formData.getAll("venueNote") as string[];
  const venues: { name: string; address: string; note: string }[] = [];
  for (let i = 0; i < names.length; i++) {
    if (names[i]?.trim()) {
      venues.push({ name: names[i].trim(), address: (addresses[i] ?? "").trim(), note: (notes[i] ?? "").trim() });
    }
  }
  return venues;
}

function eventDataFromForm(formData: FormData) {
  const buildDate = formData.get("buildDate") as string;
  const strikeDate = formData.get("strikeDate") as string;
  const clientId = String(formData.get("clientId") ?? "").trim();
  return {
    title: String(formData.get("title") ?? "").trim(),
    brief: String(formData.get("brief") ?? "").trim(),
    clientId: clientId || null,
    clientName: String(formData.get("clientName") ?? "").trim(),
    clientPhone: String(formData.get("clientPhone") ?? "").trim(),
    clientEmail: String(formData.get("clientEmail") ?? "").trim(),
    companyName: String(formData.get("companyName") ?? "").trim(),
    companyAddress: String(formData.get("companyAddress") ?? "").trim(),
    companyIco: String(formData.get("companyIco") ?? "").trim(),
    companyDic: String(formData.get("companyDic") ?? "").trim(),
    status: formData.get("status") as EventStatus,
    buildDate: buildDate ? new Date(buildDate) : null,
    startDate: new Date(formData.get("startDate") as string),
    endDate: new Date(formData.get("endDate") as string),
    strikeDate: strikeDate ? new Date(strikeDate) : null,
    quotedValue: Number(formData.get("quotedValue") ?? 0) || 0,
  };
}

export async function createEventAction(_prev: EventFormState, formData: FormData): Promise<EventFormState> {
  const user = await requireUser();
  if (!canCreateEvent(user)) {
    return { error: "You don't have permission to create events." };
  }

  const data = eventDataFromForm(formData);
  if (!data.title || !data.companyName || !data.clientName) {
    return { error: "Title, client contact and client company are required." };
  }
  data.clientId = await resolveClientId(data.clientId, {
    name: data.companyName,
    address: data.companyAddress,
    ico: data.companyIco,
    dic: data.companyDic,
  });

  const event = await prisma.event.create({
    data: {
      ...data,
      ownerId: user.id,
      venues: { create: parseVenues(formData) },
      members: { create: [{ userId: user.id }] },
    },
  });

  revalidatePath("/events");
  revalidatePath("/dashboard");
  redirect(`/events/${event.id}`);
}

export async function updateEventAction(_prev: EventFormState, formData: FormData): Promise<EventFormState> {
  const user = await requireUser();
  const id = String(formData.get("id"));

  const existing = await prisma.event.findUnique({ where: { id }, include: { members: true } });
  if (!existing) return { error: "Event not found." };
  if (!canEditEvent(user, { ownerId: existing.ownerId, memberIds: existing.members.map((m) => m.userId) })) {
    return { error: "You don't have permission to edit this event." };
  }

  const data = eventDataFromForm(formData);
  if (!data.title || !data.companyName || !data.clientName) {
    return { error: "Title, client contact and client company are required." };
  }
  data.clientId = await resolveClientId(data.clientId, {
    name: data.companyName,
    address: data.companyAddress,
    ico: data.companyIco,
    dic: data.companyDic,
  });

  await prisma.$transaction([
    prisma.venue.deleteMany({ where: { eventId: id } }),
    prisma.event.update({
      where: { id },
      data: { ...data, venues: { create: parseVenues(formData) } },
    }),
  ]);

  revalidatePath(`/events/${id}`);
  revalidatePath("/events");
  revalidatePath("/dashboard");
  redirect(`/events/${id}`);
}

/**
 * Admin-only, irreversible: cascades through the schema's onDelete: Cascade
 * relations (members, venues, milestones, time entries, quotes+items,
 * invoices+items/payments/history) — see CLAUDE.md for the full list.
 *
 * Refuses to delete an event that has any expenses or invoices recorded
 * against it — those need to be reassigned or removed first rather than
 * silently wiped out along with everything else. The primary gate is
 * client-side (DeleteEventButton shows a popup explaining why and never
 * submits in that case); this check is defense in depth against a stale
 * page or a direct spoofed request, so it silently no-ops rather than
 * throwing (matches the isAdmin check just above it). Quotes aren't part of
 * this gate — an accepted-but-not-yet-invoiced quote is still safe to lose
 * along with the event, same as a draft. Since expenses always block the
 * delete, there's never a receipt file left to clean up here.
 */
export async function deleteEventAction(formData: FormData) {
  const user = await requireUser();
  if (!isAdmin(user)) return;

  const id = String(formData.get("id"));
  const [expenseCount, invoiceCount] = await Promise.all([
    prisma.expense.count({ where: { eventId: id } }),
    prisma.invoice.count({ where: { eventId: id } }),
  ]);
  if (expenseCount > 0 || invoiceCount > 0) return;

  await prisma.event.delete({ where: { id } });

  revalidatePath("/events");
  revalidatePath("/dashboard");
  revalidatePath("/finance/quotes");
  revalidatePath("/finance/invoices");
  revalidatePath("/finance/expenses");
  redirect("/events");
}

export type QuickEventState = { error?: string; event?: { id: string; title: string; companyName: string } };

/**
 * Minimal event creation used from the "+ New event" modal on the Quote/
 * Invoice/Expense forms — just enough fields to pick the event right after,
 * not the full EventForm. Returns the created event instead of redirecting
 * so the modal can hand it back to the picker without leaving the page.
 */
export async function quickCreateEventAction(_prev: QuickEventState, formData: FormData): Promise<QuickEventState> {
  const user = await requireUser();
  if (!canCreateEvent(user)) return { error: "You don't have permission to create events." };

  const title = String(formData.get("title") ?? "").trim();
  const clientName = String(formData.get("clientName") ?? "").trim();
  const companyName = String(formData.get("companyName") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");

  if (!title || !clientName || !companyName || !startDate || !endDate) {
    return { error: "All fields are required." };
  }

  const event = await prisma.event.create({
    data: {
      title,
      clientName,
      companyName,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      ownerId: user.id,
      members: { create: [{ userId: user.id }] },
    },
  });

  revalidatePath("/events");
  revalidatePath("/dashboard");
  return { event: { id: event.id, title: event.title, companyName: event.companyName } };
}

export async function addMilestoneAction(formData: FormData) {
  const user = await requireUser();
  const eventId = String(formData.get("eventId"));
  const title = String(formData.get("title") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  if (!title || !date) return;

  const event = await prisma.event.findUnique({ where: { id: eventId }, include: { members: true } });
  if (!event) return;
  if (!canEditEvent(user, { ownerId: event.ownerId, memberIds: event.members.map((m) => m.userId) })) return;

  await prisma.milestone.create({ data: { eventId, title, date: new Date(date) } });
  revalidatePath(`/events/${eventId}/milestones`);
  revalidatePath(`/events/${eventId}`);
}

export async function deleteMilestoneAction(formData: FormData) {
  const user = await requireUser();
  const milestoneId = String(formData.get("milestoneId"));
  const eventId = String(formData.get("eventId"));

  const event = await prisma.event.findUnique({ where: { id: eventId }, include: { members: true } });
  if (!event) return;
  if (!canEditEvent(user, { ownerId: event.ownerId, memberIds: event.members.map((m) => m.userId) })) return;

  await prisma.milestone.delete({ where: { id: milestoneId } });
  revalidatePath(`/events/${eventId}/milestones`);
  revalidatePath(`/events/${eventId}`);
}
