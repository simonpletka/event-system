"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, eventWhereForUser } from "@/lib/authz";
import { getRunningTimer } from "@/lib/queries/timetracker";
import type { TimePhase } from "@/generated/prisma/enums";

export type TimeFormState = { error?: string; success?: boolean; discardedTooShort?: boolean };

const MIN_TIMER_SECONDS = 10;

/** A timer stopped in under MIN_TIMER_SECONDS is almost always an accidental click — discard it instead of saving a near-zero entry. */
async function stopRunningTimerFor(userId: string): Promise<{ discardedTooShort: boolean }> {
  const running = await getRunningTimer(userId);
  if (!running || !running.startedAt) return { discardedTooShort: false };
  const elapsedSeconds = (Date.now() - running.startedAt.getTime()) / 1000;
  if (elapsedSeconds < MIN_TIMER_SECONDS) {
    await prisma.timeEntry.delete({ where: { id: running.id } });
    return { discardedTooShort: true };
  }
  const minutes = Math.max(1, Math.round(elapsedSeconds / 60));
  await prisma.timeEntry.update({
    where: { id: running.id },
    data: { running: false, endedAt: new Date(), minutes },
  });
  return { discardedTooShort: false };
}

/**
 * eventId is optional — a timer can be started with no event picked yet
 * ("track now, assign later") and edited afterward via
 * updateManualEntryAction. When one is given, it's still validated against
 * the user's own access the same as before.
 */
export async function startTimerAction(formData: FormData) {
  const user = await requireUser();
  const eventId = String(formData.get("eventId") ?? "") || null;
  const description = String(formData.get("description") ?? "");
  const phase = (formData.get("phase") as TimePhase) || "PLANNING";

  if (eventId) {
    const event = await prisma.event.findFirst({ where: { id: eventId, ...eventWhereForUser(user) } });
    if (!event) return;
  }

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
  if (eventId) revalidatePath(`/events/${eventId}`, "layout");
}

export async function stopTimerAction(_prev: TimeFormState, formData: FormData): Promise<TimeFormState> {
  const user = await requireUser();
  const description = formData.get("description");
  if (typeof description === "string") {
    const running = await getRunningTimer(user.id);
    if (running) await prisma.timeEntry.update({ where: { id: running.id }, data: { description } });
  }
  const { discardedTooShort } = await stopRunningTimerFor(user.id);

  revalidatePath("/time-tracker");
  revalidatePath("/dashboard");
  return { success: true, discardedTooShort };
}

function combineDateTime(dateStr: string, timeStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  return new Date(y, m - 1, d, h, min);
}

/**
 * Duration-only manual entries never get startedAt/endedAt (nothing to
 * position them at on the Calendar view's hourly grid); entries with real
 * start/end times get both fields set, not just a computed minute count, so
 * the Calendar view can actually place them.
 */
function computeMinutesAndTimes(formData: FormData, dateStr: string) {
  const start = String(formData.get("startTime") ?? "");
  const end = String(formData.get("endTime") ?? "");
  const duration = Number(formData.get("duration") ?? 0);

  if (start && end) {
    const startedAt = combineDateTime(dateStr, start);
    const endedAt = combineDateTime(dateStr, end);
    const diff = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);
    if (diff > 0) return { minutes: diff, startedAt, endedAt };
  }
  if (duration > 0) return { minutes: Math.round(duration), startedAt: null, endedAt: null };
  return { minutes: 0, startedAt: null, endedAt: null };
}

/** eventId is optional here too — same "assign later" reasoning as startTimerAction. */
async function createManualEntry(user: Awaited<ReturnType<typeof requireUser>>, formData: FormData): Promise<TimeFormState & { eventId?: string | null }> {
  const eventId = String(formData.get("eventId") ?? "") || null;
  const date = String(formData.get("date") ?? "");
  const description = String(formData.get("description") ?? "");
  const phase = (formData.get("phase") as TimePhase) || "PLANNING";
  if (!date) {
    return { error: "Date and either a start/end time or a duration are required." };
  }
  const { minutes, startedAt, endedAt } = computeMinutesAndTimes(formData, date);
  if (minutes <= 0) {
    return { error: "Date and either a start/end time or a duration are required." };
  }

  if (eventId) {
    const event = await prisma.event.findFirst({ where: { id: eventId, ...eventWhereForUser(user) } });
    if (!event) return { error: "Event not found or not accessible." };
  }

  await prisma.timeEntry.create({
    data: { eventId, userId: user.id, date: new Date(date), minutes, description, phase, startedAt, endedAt },
  });

  return { success: true, eventId };
}

/** Used by the calendar's draw-to-create popup — the only way to add a non-timer entry now that the standalone manual-entry form is gone. */
export async function addCalendarEntryAction(_prev: TimeFormState, formData: FormData): Promise<TimeFormState> {
  const user = await requireUser();
  const result = await createManualEntry(user, formData);
  if (result.error) return result;

  revalidatePath("/time-tracker");
  if (result.eventId) revalidatePath(`/events/${result.eventId}`, "layout");
  return { success: true };
}

/** Also handles assigning/reassigning/clearing the event on an existing entry. */
export async function updateManualEntryAction(_prev: TimeFormState, formData: FormData): Promise<TimeFormState> {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const existing = await prisma.timeEntry.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) return { error: "Entry not found." };
  if (existing.running) return { error: "Stop the running timer before editing it." };

  const eventId = String(formData.get("eventId") ?? "") || null;
  const date = String(formData.get("date") ?? "");
  const description = String(formData.get("description") ?? "");
  const phase = (formData.get("phase") as TimePhase) || "PLANNING";
  if (!date) return { error: "Date and either a start/end time or a duration are required." };
  const { minutes, startedAt, endedAt } = computeMinutesAndTimes(formData, date);
  if (minutes <= 0) return { error: "Date and either a start/end time or a duration are required." };

  if (eventId) {
    const event = await prisma.event.findFirst({ where: { id: eventId, ...eventWhereForUser(user) } });
    if (!event) return { error: "Event not found or not accessible." };
  }

  await prisma.timeEntry.update({
    where: { id },
    data: { eventId, date: new Date(date), minutes, description, phase, startedAt, endedAt },
  });

  revalidatePath("/time-tracker");
  if (existing.eventId) revalidatePath(`/events/${existing.eventId}`, "layout");
  if (eventId) revalidatePath(`/events/${eventId}`, "layout");
  return { success: true };
}

export async function deleteTimeEntryAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const existing = await prisma.timeEntry.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) return;

  await prisma.timeEntry.delete({ where: { id } });
  revalidatePath("/time-tracker");
  if (existing.eventId) revalidatePath(`/events/${existing.eventId}`, "layout");
}

/** Assigns (or reassigns) the event on the user's currently running timer, without stopping it. */
export async function assignRunningTimerEventAction(formData: FormData) {
  const user = await requireUser();
  const running = await getRunningTimer(user.id);
  if (!running) return;

  const eventId = String(formData.get("eventId") ?? "") || null;
  if (eventId) {
    const event = await prisma.event.findFirst({ where: { id: eventId, ...eventWhereForUser(user) } });
    if (!event) return;
  }

  await prisma.timeEntry.update({ where: { id: running.id }, data: { eventId } });

  revalidatePath("/time-tracker");
  revalidatePath("/dashboard");
  if (eventId) revalidatePath(`/events/${eventId}`, "layout");
}

/** Same as assignRunningTimerEventAction but for the phase — lets the running timer's phase pill be reassigned in place. */
export async function assignRunningTimerPhaseAction(formData: FormData) {
  const user = await requireUser();
  const running = await getRunningTimer(user.id);
  if (!running) return;

  const phase = (formData.get("phase") as TimePhase) || "PLANNING";
  await prisma.timeEntry.update({ where: { id: running.id }, data: { phase } });

  revalidatePath("/time-tracker");
  revalidatePath("/dashboard");
}

/** Adjusts the start time of the user's currently running timer. The end time can't be touched — it's still running. */
export async function adjustRunningTimerStartAction(_prev: TimeFormState, formData: FormData): Promise<TimeFormState> {
  const user = await requireUser();
  const running = await getRunningTimer(user.id);
  if (!running || !running.startedAt) return { error: "No timer is running." };

  const date = String(formData.get("date") ?? "");
  const startTime = String(formData.get("startTime") ?? "");
  if (!date || !startTime) return { error: "Start date and time are required." };

  const startedAt = combineDateTime(date, startTime);
  if (startedAt.getTime() > Date.now()) return { error: "Start time can't be in the future." };

  await prisma.timeEntry.update({ where: { id: running.id }, data: { startedAt, date: startedAt } });

  revalidatePath("/time-tracker");
  revalidatePath("/dashboard");
  return { success: true };
}
