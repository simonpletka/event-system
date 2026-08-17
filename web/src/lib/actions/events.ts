"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, canEditEvent, canCreateEvent } from "@/lib/authz";
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
  return {
    title: String(formData.get("title") ?? "").trim(),
    brief: String(formData.get("brief") ?? "").trim(),
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
