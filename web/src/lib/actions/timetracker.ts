"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, projectWhereForUser } from "@/lib/authz";
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
 * projectId is optional — a timer can be started with no project picked yet
 * ("track now, assign later") and edited afterward via
 * updateManualEntryAction. When one is given, it's still validated against
 * the user's own access the same as before.
 */
export async function startTimerAction(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "") || null;
  const description = String(formData.get("description") ?? "");
  const phase = (formData.get("phase") as TimePhase) || "PLANNING";

  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, ...projectWhereForUser(user) } });
    if (!project) return;
  }

  await stopRunningTimerFor(user.id);

  await prisma.timeEntry.create({
    data: {
      projectId,
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
  if (projectId) revalidatePath(`/projects/${projectId}`, "layout");
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

/**
 * Builds the instant for a wall-clock date+time in the *browser's* timezone,
 * not the server's. `tzOffsetMinutes` is the client's `Date.getTimezoneOffset()`
 * (minutes to add to local time to reach UTC — e.g. -120 for CET summer),
 * passed as a hidden form field. Without this the server would interpret
 * "14:00" in its own zone, so a UTC-hosted deploy stored/replayed drawn
 * entries ~2h off (see the "Local dates" gotcha in CLAUDE.md).
 */
function combineDateTime(dateStr: string, timeStr: string, tzOffsetMinutes: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, h, min) + tzOffsetMinutes * 60000);
}

function tzOffsetOf(formData: FormData) {
  return Number(formData.get("tzOffsetMinutes") ?? 0);
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
  const tzOffset = tzOffsetOf(formData);

  if (start && end) {
    const startedAt = combineDateTime(dateStr, start, tzOffset);
    const endedAt = combineDateTime(dateStr, end, tzOffset);
    const diff = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);
    if (diff > 0) return { minutes: diff, startedAt, endedAt };
  }
  if (duration > 0) return { minutes: Math.round(duration), startedAt: null, endedAt: null };
  return { minutes: 0, startedAt: null, endedAt: null };
}

/** projectId is optional here too — same "assign later" reasoning as startTimerAction. */
async function createManualEntry(user: Awaited<ReturnType<typeof requireUser>>, formData: FormData): Promise<TimeFormState & { projectId?: string | null }> {
  const projectId = String(formData.get("projectId") ?? "") || null;
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

  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, ...projectWhereForUser(user) } });
    if (!project) return { error: "Project not found or not accessible." };
  }

  await prisma.timeEntry.create({
    data: { projectId, userId: user.id, date: new Date(date), minutes, description, phase, startedAt, endedAt },
  });

  return { success: true, projectId };
}

/** Used by the calendar's draw-to-create popup — the only way to add a non-timer entry now that the standalone manual-entry form is gone. */
export async function addCalendarEntryAction(_prev: TimeFormState, formData: FormData): Promise<TimeFormState> {
  const user = await requireUser();
  const result = await createManualEntry(user, formData);
  if (result.error) return result;

  revalidatePath("/time-tracker");
  if (result.projectId) revalidatePath(`/projects/${result.projectId}`, "layout");
  return { success: true };
}

/** Also handles assigning/reassigning/clearing the project on an existing entry. */
export async function updateManualEntryAction(_prev: TimeFormState, formData: FormData): Promise<TimeFormState> {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const existing = await prisma.timeEntry.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) return { error: "Entry not found." };
  if (existing.running) return { error: "Stop the running timer before editing it." };

  const projectId = String(formData.get("projectId") ?? "") || null;
  const date = String(formData.get("date") ?? "");
  const description = String(formData.get("description") ?? "");
  const phase = (formData.get("phase") as TimePhase) || "PLANNING";
  if (!date) return { error: "Date and either a start/end time or a duration are required." };
  const { minutes, startedAt, endedAt } = computeMinutesAndTimes(formData, date);
  if (minutes <= 0) return { error: "Date and either a start/end time or a duration are required." };

  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, ...projectWhereForUser(user) } });
    if (!project) return { error: "Project not found or not accessible." };
  }

  await prisma.timeEntry.update({
    where: { id },
    data: { projectId, date: new Date(date), minutes, description, phase, startedAt, endedAt },
  });

  revalidatePath("/time-tracker");
  if (existing.projectId) revalidatePath(`/projects/${existing.projectId}`, "layout");
  if (projectId) revalidatePath(`/projects/${projectId}`, "layout");
  return { success: true };
}

export async function deleteTimeEntryAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const existing = await prisma.timeEntry.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) return;

  await prisma.timeEntry.delete({ where: { id } });
  revalidatePath("/time-tracker");
  if (existing.projectId) revalidatePath(`/projects/${existing.projectId}`, "layout");
}

/** Assigns (or reassigns) the project on the user's currently running timer, without stopping it. */
export async function assignRunningTimerProjectAction(formData: FormData) {
  const user = await requireUser();
  const running = await getRunningTimer(user.id);
  if (!running) return;

  const projectId = String(formData.get("projectId") ?? "") || null;
  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, ...projectWhereForUser(user) } });
    if (!project) return;
  }

  await prisma.timeEntry.update({ where: { id: running.id }, data: { projectId } });

  revalidatePath("/time-tracker");
  revalidatePath("/dashboard");
  if (projectId) revalidatePath(`/projects/${projectId}`, "layout");
}

/** Same as assignRunningTimerProjectAction but for the phase — lets the running timer's phase pill be reassigned in place. */
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

  const startedAt = combineDateTime(date, startTime, tzOffsetOf(formData));
  if (startedAt.getTime() > Date.now()) return { error: "Start time can't be in the future." };

  await prisma.timeEntry.update({ where: { id: running.id }, data: { startedAt, date: startedAt } });

  revalidatePath("/time-tracker");
  revalidatePath("/dashboard");
  return { success: true };
}
