"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageMeetings } from "@/lib/authz";
import { tryCreateNotionMeetingPage } from "@/lib/notion";
import type { MeetingType, RecurrenceFreq } from "@/generated/prisma/enums";

export type MeetingFormState = { error?: string; success?: boolean };

function parseProjectIds(formData: FormData) {
  return [...new Set((formData.getAll("projectIds") as string[]).map((s) => s.trim()).filter(Boolean))];
}

function parseMeetingType(v: FormDataEntryValue | null): MeetingType {
  return v === "INTERNAL" ? "INTERNAL" : "CLIENT";
}

function parseRecurrenceFreq(v: FormDataEntryValue | null): RecurrenceFreq {
  return v === "DAILY" || v === "WEEKLY" || v === "MONTHLY" ? v : "NONE";
}

function meetingDataFromForm(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const dateRaw = String(formData.get("date") ?? "");
  const allDay = formData.get("allDay") === "on";
  const recurrenceFreq = parseRecurrenceFreq(formData.get("recurrenceFreq"));
  const untilRaw = String(formData.get("recurrenceUntil") ?? "");
  const intervalRaw = Number(formData.get("recurrenceInterval") ?? 1);

  if (!title || !dateRaw) return null;
  const date = new Date(dateRaw);
  if (Number.isNaN(date.getTime())) return null;

  return {
    title,
    type: parseMeetingType(formData.get("type")),
    date,
    allDay,
    attendees: String(formData.get("attendees") ?? "").trim(),
    note: String(formData.get("note") ?? "").trim(),
    recurrenceFreq,
    recurrenceInterval: recurrenceFreq === "NONE" ? 1 : Math.max(1, Math.floor(intervalRaw) || 1),
    recurrenceUntil: recurrenceFreq !== "NONE" && untilRaw ? new Date(untilRaw) : null,
  };
}

function revalidateMeetings(projectIds: string[]) {
  revalidatePath("/meetings");
  revalidatePath("/dashboard");
  for (const projectId of projectIds) revalidatePath(`/projects/${projectId}`, "layout");
}

/** Best-effort push to the correct Notion meeting database — never blocks the caller. */
async function syncMeetingToNotion(
  meeting: { type: MeetingType; title: string; date: Date; allDay: boolean; attendees: string },
  projectIds: string[]
) {
  const linkedProjects = projectIds.length
    ? await prisma.project.findMany({ where: { id: { in: projectIds } }, select: { notionPageId: true, companyName: true } })
    : [];
  await tryCreateNotionMeetingPage(meeting, {
    linkedProjectPageIds: linkedProjects.map((e) => e.notionPageId).filter((id): id is string => !!id),
    clientName: linkedProjects[0]?.companyName,
  });
}

export async function createMeetingAction(_prev: MeetingFormState, formData: FormData): Promise<MeetingFormState> {
  const user = await requireUser();
  if (!canManageMeetings(user)) return { error: "You don't have permission to create meetings." };

  const data = meetingDataFromForm(formData);
  if (!data) return { error: "A title and a date are required." };
  const projectIds = parseProjectIds(formData);

  const meeting = await prisma.meeting.create({
    data: { ...data, createdById: user.id, projects: { create: projectIds.map((projectId) => ({ projectId })) } },
  });

  await syncMeetingToNotion(meeting, projectIds);

  revalidateMeetings(projectIds);
  return { success: true };
}

export async function updateMeetingAction(_prev: MeetingFormState, formData: FormData): Promise<MeetingFormState> {
  const user = await requireUser();
  if (!canManageMeetings(user)) return { error: "You don't have permission to edit meetings." };

  const id = String(formData.get("id"));
  const existing = await prisma.meeting.findUnique({ where: { id }, include: { projects: true } });
  if (!existing) return { error: "Meeting not found." };

  const data = meetingDataFromForm(formData);
  if (!data) return { error: "A title and a date are required." };
  const projectIds = parseProjectIds(formData);

  await prisma.$transaction([
    prisma.meeting.update({ where: { id }, data }),
    prisma.meetingProject.deleteMany({ where: { meetingId: id } }),
    prisma.meetingProject.createMany({ data: projectIds.map((projectId) => ({ meetingId: id, projectId })) }),
  ]);

  const priorProjectIds = existing.projects.map((e) => e.projectId);
  revalidateMeetings([...new Set([...priorProjectIds, ...projectIds])]);
  return { success: true };
}

export async function deleteMeetingAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageMeetings(user)) return;

  const id = String(formData.get("id"));
  const existing = await prisma.meeting.findUnique({ where: { id }, include: { projects: true } });
  if (!existing) return;

  await prisma.meeting.delete({ where: { id } });
  revalidateMeetings(existing.projects.map((e) => e.projectId));
}

/**
 * Drag-and-drop reschedule from the weekly calendar (WeekCalendar.tsx), for a
 * non-recurring meeting only — unambiguous, so it fires immediately with no
 * choice dialog. Recurring meetings go through
 * rescheduleMeetingOccurrenceAction / splitMeetingSeriesAction instead.
 * Silently no-ops on failure, matching rescheduleRoadmapItemAction — fired
 * from a drag gesture with no error UI.
 */
export async function rescheduleMeetingAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageMeetings(user)) return;

  const id = String(formData.get("id"));
  const dateRaw = String(formData.get("date") ?? "");
  if (!dateRaw) return;

  const meeting = await prisma.meeting.findUnique({ where: { id }, include: { projects: true } });
  if (!meeting || meeting.recurrenceFreq !== "NONE") return;

  await prisma.meeting.update({ where: { id }, data: { date: new Date(dateRaw) } });
  revalidateMeetings(meeting.projects.map((e) => e.projectId));
}

/**
 * Drag-and-drop reschedule of a single occurrence within a recurring series
 * — "this occurrence only" from the calendar's choice dialog. Records/
 * overwrites a MeetingException keyed by the dragged occurrence's original
 * (un-shifted) date; the rest of the series is untouched.
 */
export async function rescheduleMeetingOccurrenceAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageMeetings(user)) return;

  const meetingId = String(formData.get("meetingId"));
  const originalDateRaw = String(formData.get("originalDate") ?? "");
  const newDateRaw = String(formData.get("newDate") ?? "");
  if (!originalDateRaw || !newDateRaw) return;

  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId }, include: { projects: true } });
  if (!meeting || meeting.recurrenceFreq === "NONE") return;

  const originalDate = new Date(originalDateRaw);
  await prisma.meetingException.upsert({
    where: { meetingId_originalDate: { meetingId, originalDate } },
    create: { meetingId, originalDate, newDate: new Date(newDateRaw) },
    update: { newDate: new Date(newDateRaw) },
  });
  revalidateMeetings(meeting.projects.map((e) => e.projectId));
}

/**
 * Drag-and-drop reschedule of "this and all future occurrences" — the
 * calendar's other choice-dialog option. Truncates the original series to
 * end just before the dragged occurrence's original date, then starts a
 * fresh series (same title/type/recurrence rule/project links) at the new
 * date. Any exceptions already recorded for occurrences after the split
 * point move with the new series; the split point itself never had one (it
 * IS the split). Also pushes a new Notion page for the continuation series,
 * matching what a freshly created meeting gets.
 */
export async function splitMeetingSeriesAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageMeetings(user)) return;

  const meetingId = String(formData.get("meetingId"));
  const originalDateRaw = String(formData.get("originalDate") ?? "");
  const newDateRaw = String(formData.get("newDate") ?? "");
  if (!originalDateRaw || !newDateRaw) return;

  const originalDate = new Date(originalDateRaw);
  const newDate = new Date(newDateRaw);

  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId }, include: { projects: true } });
  if (!meeting || meeting.recurrenceFreq === "NONE") return;

  const newMeeting = await prisma.meeting.create({
    data: {
      title: meeting.title,
      type: meeting.type,
      date: newDate,
      allDay: meeting.allDay,
      attendees: meeting.attendees,
      note: meeting.note,
      recurrenceFreq: meeting.recurrenceFreq,
      recurrenceInterval: meeting.recurrenceInterval,
      recurrenceUntil: meeting.recurrenceUntil,
      createdById: meeting.createdById,
      projects: { create: meeting.projects.map((e) => ({ projectId: e.projectId })) },
    },
  });

  await prisma.$transaction([
    prisma.meeting.update({ where: { id: meetingId }, data: { recurrenceUntil: new Date(originalDate.getTime() - 1000) } }),
    prisma.meetingException.updateMany({
      where: { meetingId, originalDate: { gt: originalDate } },
      data: { meetingId: newMeeting.id },
    }),
  ]);

  await syncMeetingToNotion(newMeeting, meeting.projects.map((e) => e.projectId));

  revalidateMeetings(meeting.projects.map((e) => e.projectId));
}
