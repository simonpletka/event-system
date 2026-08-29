"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, canEditEvent } from "@/lib/authz";
import { getEventDetail } from "@/lib/queries/events";
import { parseRoadmapType } from "@/lib/roadmap";

export type RoadmapFormState = { error?: string; success?: boolean };

/** Loads the event with members and checks edit rights. Returns null on any failure. */
async function loadEditableEvent(eventId: string) {
  const user = await requireUser();
  const event = await prisma.event.findUnique({ where: { id: eventId }, include: { members: true } });
  if (!event) return null;
  if (!canEditEvent(user, { ownerId: event.ownerId, memberIds: event.members.map((m) => m.userId) })) return null;
  return { user, event };
}

function revalidateEvent(eventId: string) {
  revalidatePath(`/events/${eventId}`, "layout");
  revalidatePath("/events");
  revalidatePath("/events?view=calendar");
  revalidatePath("/dashboard");
}

/** Assigning someone to a roadmap item also makes them an event member so they can see the event. */
async function ensureMembers(eventId: string, userIds: string[]) {
  for (const userId of userIds) {
    await prisma.eventMember.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, userId },
      update: {},
    });
  }
}

function parseDate(formData: FormData): { date: Date; allDay: boolean } | null {
  const raw = String(formData.get("date") ?? "");
  const allDay = formData.get("allDay") === "on";
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return { date, allDay };
}

function parseExternalAttendees(formData: FormData) {
  const names = formData.getAll("attendeeName") as string[];
  const emails = formData.getAll("attendeeEmail") as string[];
  return names
    .map((name, i) => ({ name: name.trim(), email: (emails[i] ?? "").trim() }))
    .filter((r) => r.name || r.email)
    .map((r) => ({ name: r.name || r.email, email: r.email }));
}

export async function addRoadmapItemAction(_prev: RoadmapFormState, formData: FormData): Promise<RoadmapFormState> {
  const eventId = String(formData.get("eventId"));
  const ctx = await loadEditableEvent(eventId);
  if (!ctx) return { error: "You don't have permission to edit this event." };

  const title = String(formData.get("title") ?? "").trim();
  const parsed = parseDate(formData);
  if (!title || !parsed) return { error: "A title and a date are required." };

  const assigneeIds = [...new Set((formData.getAll("assignees") as string[]).filter(Boolean))];
  await ensureMembers(eventId, assigneeIds);

  await prisma.roadmapItem.create({
    data: {
      eventId,
      type: parseRoadmapType(formData.get("type")),
      title,
      date: parsed.date,
      allDay: parsed.allDay,
      note: String(formData.get("note") ?? "").trim(),
      createdById: ctx.user.id,
      assignees: { create: assigneeIds.map((userId) => ({ userId })) },
      externalAttendees: { create: parseExternalAttendees(formData) },
    },
  });

  revalidateEvent(eventId);
  return { success: true };
}

export async function updateRoadmapItemAction(_prev: RoadmapFormState, formData: FormData): Promise<RoadmapFormState> {
  const id = String(formData.get("id"));
  const item = await prisma.roadmapItem.findUnique({ where: { id }, select: { eventId: true } });
  if (!item) return { error: "Item not found." };
  const ctx = await loadEditableEvent(item.eventId);
  if (!ctx) return { error: "You don't have permission to edit this event." };

  const title = String(formData.get("title") ?? "").trim();
  const parsed = parseDate(formData);
  if (!title || !parsed) return { error: "A title and a date are required." };

  const assigneeIds = [...new Set((formData.getAll("assignees") as string[]).filter(Boolean))];
  await ensureMembers(item.eventId, assigneeIds);

  await prisma.$transaction([
    prisma.roadmapItem.update({
      where: { id },
      data: {
        type: parseRoadmapType(formData.get("type")),
        title,
        date: parsed.date,
        allDay: parsed.allDay,
        note: String(formData.get("note") ?? "").trim(),
      },
    }),
    prisma.roadmapAssignee.deleteMany({ where: { itemId: id } }),
    prisma.roadmapAssignee.createMany({ data: assigneeIds.map((userId) => ({ itemId: id, userId })) }),
    prisma.roadmapExternalAttendee.deleteMany({ where: { itemId: id } }),
    prisma.roadmapExternalAttendee.createMany({ data: parseExternalAttendees(formData).map((r) => ({ itemId: id, ...r })) }),
  ]);

  revalidateEvent(item.eventId);
  return { success: true };
}

export async function deleteRoadmapItemAction(formData: FormData) {
  const id = String(formData.get("id"));
  const item = await prisma.roadmapItem.findUnique({ where: { id }, select: { eventId: true } });
  if (!item) return;
  const ctx = await loadEditableEvent(item.eventId);
  if (!ctx) return;
  await prisma.roadmapItem.delete({ where: { id } });
  revalidateEvent(item.eventId);
}

export async function toggleRoadmapItemDoneAction(formData: FormData) {
  const id = String(formData.get("id"));
  const item = await prisma.roadmapItem.findUnique({ where: { id }, select: { eventId: true, done: true } });
  if (!item) return;
  const ctx = await loadEditableEvent(item.eventId);
  if (!ctx) return;
  await prisma.roadmapItem.update({ where: { id }, data: { done: !item.done } });
  revalidateEvent(item.eventId);
}

export async function addRoadmapCommentAction(_prev: RoadmapFormState, formData: FormData): Promise<RoadmapFormState> {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write something first." };

  const item = await prisma.roadmapItem.findUnique({ where: { id }, select: { eventId: true } });
  if (!item) return { error: "Item not found." };
  // Looser gate than editing: anyone who can see the event can comment.
  const visible = await getEventDetail(user, item.eventId);
  if (!visible) return { error: "You don't have access to this event." };

  await prisma.roadmapComment.create({ data: { itemId: id, authorId: user.id, body } });
  revalidatePath(`/events/${item.eventId}/roadmap`);
  return { success: true };
}

/**
 * Drag-and-drop reschedule from the weekly calendar (WeekCalendar.tsx).
 * Silently no-ops on failure — fired from a drag gesture with no error UI.
 */
export async function rescheduleRoadmapItemAction(formData: FormData) {
  const id = String(formData.get("itemId"));
  const dateRaw = String(formData.get("date") ?? "");
  if (!dateRaw) return;
  const item = await prisma.roadmapItem.findUnique({ where: { id }, select: { eventId: true } });
  if (!item) return;
  const ctx = await loadEditableEvent(item.eventId);
  if (!ctx) return;
  await prisma.roadmapItem.update({ where: { id }, data: { date: new Date(dateRaw) } });
  revalidateEvent(item.eventId);
}
