"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, canEditEvent, canCreateEvent, isAdmin } from "@/lib/authz";
import { resolveClientId, syncClientContacts } from "@/lib/actions/clients";
import { nextEventNumber } from "@/lib/document-number";
import { addDays } from "@/lib/calendar";
import { normaliseBudgetInput } from "@/lib/event-budget";
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

function parseContacts(formData: FormData) {
  const names = formData.getAll("contactName") as string[];
  const phones = formData.getAll("contactPhone") as string[];
  const emails = formData.getAll("contactEmail") as string[];
  const contacts: { name: string; phone: string; email: string }[] = [];
  for (let i = 0; i < names.length; i++) {
    if (names[i]?.trim()) {
      contacts.push({ name: names[i].trim(), phone: (phones[i] ?? "").trim(), email: (emails[i] ?? "").trim() });
    }
  }
  return contacts;
}

/**
 * Budget fields, only ever read for an Admin (the form doesn't render them
 * otherwise). Returns undefined for non-admins so the spread in the actions
 * leaves the existing DB values untouched.
 */
function budgetDataFromForm(formData: FormData, isAdminUser: boolean) {
  if (!isAdminUser) return undefined;
  const type = String(formData.get("budgetType") ?? "NONE");
  const field = type === "FIXED" ? "budgetAmount" : "budgetPercent";
  return normaliseBudgetInput(type, Number(formData.get(field) ?? 0));
}

function eventDataFromForm(formData: FormData) {
  const buildDate = formData.get("buildDate") as string;
  const strikeDate = formData.get("strikeDate") as string;
  const clientId = String(formData.get("clientId") ?? "").trim();
  return {
    title: String(formData.get("title") ?? "").trim(),
    brief: String(formData.get("brief") ?? "").trim(),
    clientId: clientId || null,
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
  const contacts = parseContacts(formData);
  if (!data.title || !data.companyName || contacts.length === 0) {
    return { error: "Title, client company and at least one contact person are required." };
  }
  data.clientId = await resolveClientId(data.clientId, {
    name: data.companyName,
    address: data.companyAddress,
    ico: data.companyIco,
    dic: data.companyDic,
  });
  await syncClientContacts(data.clientId, contacts);

  const number = await nextEventNumber();
  const event = await prisma.event.create({
    data: {
      ...data,
      ...budgetDataFromForm(formData, isAdmin(user)),
      number,
      ownerId: user.id,
      venues: { create: parseVenues(formData) },
      contacts: { create: contacts.map((c, idx) => ({ ...c, sortOrder: idx })) },
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
  const contacts = parseContacts(formData);
  if (!data.title || !data.companyName || contacts.length === 0) {
    return { error: "Title, client company and at least one contact person are required." };
  }
  data.clientId = await resolveClientId(data.clientId, {
    name: data.companyName,
    address: data.companyAddress,
    ico: data.companyIco,
    dic: data.companyDic,
  });
  await syncClientContacts(data.clientId, contacts);

  await prisma.$transaction([
    prisma.venue.deleteMany({ where: { eventId: id } }),
    prisma.eventContact.deleteMany({ where: { eventId: id } }),
    prisma.event.update({
      where: { id },
      data: {
        ...data,
        ...budgetDataFromForm(formData, isAdmin(user)),
        venues: { create: parseVenues(formData) },
        contacts: { create: contacts.map((c, idx) => ({ ...c, sortOrder: idx })) },
      },
    }),
  ]);

  revalidatePath(`/events/${id}`, "layout");
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

export type QuickEventState = {
  error?: string;
  event?: { id: string; title: string; companyName: string; quotedValue: number };
};

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

  const number = await nextEventNumber();
  const event = await prisma.event.create({
    data: {
      title,
      number,
      companyName,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      ownerId: user.id,
      contacts: { create: [{ name: clientName }] },
      members: { create: [{ userId: user.id }] },
    },
  });

  revalidatePath("/events");
  revalidatePath("/dashboard");
  return { event: { id: event.id, title: event.title, companyName: event.companyName, quotedValue: event.quotedValue } };
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

  await prisma.roadmapItem.create({ data: { eventId, title, date: new Date(date), type: "MILESTONE" } });
  revalidatePath(`/events/${eventId}/milestones`);
  revalidatePath(`/events/${eventId}`, "layout");
}

export async function deleteMilestoneAction(formData: FormData) {
  const user = await requireUser();
  const milestoneId = String(formData.get("milestoneId"));
  const eventId = String(formData.get("eventId"));

  const event = await prisma.event.findUnique({ where: { id: eventId }, include: { members: true } });
  if (!event) return;
  if (!canEditEvent(user, { ownerId: event.ownerId, memberIds: event.members.map((m) => m.userId) })) return;

  await prisma.roadmapItem.delete({ where: { id: milestoneId } });
  revalidatePath(`/events/${eventId}/milestones`);
  revalidatePath(`/events/${eventId}`, "layout");
}

/**
 * Drag-and-drop reschedule of a single milestone from the weekly calendar
 * (WeekCalendar.tsx) — sets its date/time directly to wherever it was
 * dropped in the grid. Silently no-ops on a missing event or a permission
 * failure (same defensive pattern as every other action here) since this is
 * fired from a drag gesture with no confirm step and no error UI to show.
 */
export async function rescheduleMilestoneAction(formData: FormData) {
  const user = await requireUser();
  const milestoneId = String(formData.get("milestoneId"));
  const eventId = String(formData.get("eventId"));
  const date = String(formData.get("date") ?? "");
  if (!date) return;

  const event = await prisma.event.findUnique({ where: { id: eventId }, include: { members: true } });
  if (!event) return;
  if (!canEditEvent(user, { ownerId: event.ownerId, memberIds: event.members.map((m) => m.userId) })) return;

  await prisma.roadmapItem.update({ where: { id: milestoneId }, data: { date: new Date(date) } });
  revalidatePath(`/events/${eventId}/milestones`);
  revalidatePath(`/events/${eventId}`, "layout");
  revalidatePath("/events");
  revalidatePath("/dashboard");
}

/**
 * Drag-and-drop reschedule of a whole event from the weekly calendar — shifts
 * buildDate/startDate/endDate/strikeDate (whichever are set) by the same
 * number of days, preserving each one's own time-of-day and the gaps between
 * them (a 2-day build lead stays a 2-day build lead after the move). Uses
 * addDays() (local calendar-day arithmetic) rather than raw millisecond math
 * so a shift across a DST boundary doesn't silently drift the clock time.
 */
export async function rescheduleEventAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const deltaDays = Number(formData.get("deltaDays"));
  if (!Number.isFinite(deltaDays) || deltaDays === 0) return;

  const event = await prisma.event.findUnique({ where: { id }, include: { members: true } });
  if (!event) return;
  if (!canEditEvent(user, { ownerId: event.ownerId, memberIds: event.members.map((m) => m.userId) })) return;

  await prisma.event.update({
    where: { id },
    data: {
      buildDate: event.buildDate ? addDays(event.buildDate, deltaDays) : null,
      startDate: addDays(event.startDate, deltaDays),
      endDate: addDays(event.endDate, deltaDays),
      strikeDate: event.strikeDate ? addDays(event.strikeDate, deltaDays) : null,
    },
  });

  revalidatePath(`/events/${id}`, "layout");
  revalidatePath("/events");
  revalidatePath("/dashboard");
}
