"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, eventWhereForUser } from "@/lib/authz";
import { getRunningTimer } from "@/lib/queries/timetracker";
import type { TimePhase } from "@/generated/prisma/enums";

export type TimeFormState = { error?: string };

async function stopRunningTimerFor(userId: string) {
  const running = await getRunningTimer(userId);
  if (!running || !running.startedAt) return;
  const minutes = Math.max(1, Math.round((Date.now() - running.startedAt.getTime()) / 60000));
  await prisma.timeEntry.update({
    where: { id: running.id },
    data: { running: false, endedAt: new Date(), minutes },
  });
}

export async function startTimerAction(formData: FormData) {
  const user = await requireUser();
  const eventId = String(formData.get("eventId") ?? "");
  const description = String(formData.get("description") ?? "");
  const phase = (formData.get("phase") as TimePhase) || "PLANNING";
  if (!eventId) return;

  const event = await prisma.event.findFirst({ where: { id: eventId, ...eventWhereForUser(user) } });
  if (!event) return;

  await stopRunningTimerFor(user.id);

  await prisma.timeEntry.create({
    data: {
      eventId,
      userId: user.id,
      description,
      phase,
      running: true,
      startedAt: new Date(),
      date: new Date(),
    },
  });

  revalidatePath("/time-tracker");
  revalidatePath("/dashboard");
  revalidatePath(`/events/${eventId}`);
}

export async function stopTimerAction(formData: FormData) {
  const user = await requireUser();
  const description = formData.get("description");
  if (typeof description === "string") {
    const running = await getRunningTimer(user.id);
    if (running) await prisma.timeEntry.update({ where: { id: running.id }, data: { description } });
  }
  await stopRunningTimerFor(user.id);

  revalidatePath("/time-tracker");
  revalidatePath("/dashboard");
}

function computeMinutes(formData: FormData) {
  const start = String(formData.get("startTime") ?? "");
  const end = String(formData.get("endTime") ?? "");
  const duration = Number(formData.get("duration") ?? 0);

  if (start && end) {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const diff = eh * 60 + em - (sh * 60 + sm);
    if (diff > 0) return diff;
  }
  if (duration > 0) return Math.round(duration);
  return 0;
}

export async function addManualEntryAction(_prev: TimeFormState, formData: FormData): Promise<TimeFormState> {
  const user = await requireUser();
  const eventId = String(formData.get("eventId") ?? "");
  const date = String(formData.get("date") ?? "");
  const description = String(formData.get("description") ?? "");
  const phase = (formData.get("phase") as TimePhase) || "PLANNING";
  const minutes = computeMinutes(formData);

  if (!eventId || !date || minutes <= 0) {
    return { error: "Event, date and either a start/end time or a duration are required." };
  }

  const event = await prisma.event.findFirst({ where: { id: eventId, ...eventWhereForUser(user) } });
  if (!event) return { error: "Event not found or not accessible." };

  await prisma.timeEntry.create({
    data: { eventId, userId: user.id, date: new Date(date), minutes, description, phase },
  });

  revalidatePath("/time-tracker");
  revalidatePath(`/events/${eventId}`);
  redirect("/time-tracker");
}

export async function updateManualEntryAction(_prev: TimeFormState, formData: FormData): Promise<TimeFormState> {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const existing = await prisma.timeEntry.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) return { error: "Entry not found." };
  if (existing.running) return { error: "Stop the running timer before editing it." };

  const date = String(formData.get("date") ?? "");
  const description = String(formData.get("description") ?? "");
  const phase = (formData.get("phase") as TimePhase) || "PLANNING";
  const minutes = computeMinutes(formData);
  if (!date || minutes <= 0) return { error: "Date and either a start/end time or a duration are required." };

  await prisma.timeEntry.update({
    where: { id },
    data: { date: new Date(date), minutes, description, phase },
  });

  revalidatePath("/time-tracker");
  revalidatePath(`/events/${existing.eventId}`);
  redirect("/time-tracker");
}

export async function deleteTimeEntryAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const existing = await prisma.timeEntry.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) return;

  await prisma.timeEntry.delete({ where: { id } });
  revalidatePath("/time-tracker");
  revalidatePath(`/events/${existing.eventId}`);
}
