"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, canEditProject } from "@/lib/authz";
import { getProjectDetail } from "@/lib/queries/projects";
import { parseRoadmapType } from "@/lib/roadmap";

export type RoadmapFormState = { error?: string; success?: boolean };

/** Loads the project with members and checks edit rights. Returns null on any failure. */
async function loadEditableProject(projectId: string) {
  const user = await requireUser();
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { members: true } });
  if (!project) return null;
  if (!canEditProject(user, { ownerId: project.ownerId, memberIds: project.members.map((m) => m.userId) })) return null;
  return { user, project };
}

function revalidateProject(projectId: string) {
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/projects");
  revalidatePath("/projects?view=calendar");
  revalidatePath("/dashboard");
}

/** Assigning someone to a roadmap item also makes them a project member so they can see the project. */
async function ensureMembers(projectId: string, userIds: string[]) {
  for (const userId of userIds) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      create: { projectId, userId },
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
  const projectId = String(formData.get("projectId"));
  const ctx = await loadEditableProject(projectId);
  if (!ctx) return { error: "You don't have permission to edit this project." };

  const title = String(formData.get("title") ?? "").trim();
  const parsed = parseDate(formData);
  if (!title || !parsed) return { error: "A title and a date are required." };

  const assigneeIds = [...new Set((formData.getAll("assignees") as string[]).filter(Boolean))];
  await ensureMembers(projectId, assigneeIds);

  await prisma.roadmapItem.create({
    data: {
      projectId,
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

  revalidateProject(projectId);
  return { success: true };
}

export async function updateRoadmapItemAction(_prev: RoadmapFormState, formData: FormData): Promise<RoadmapFormState> {
  const id = String(formData.get("id"));
  const item = await prisma.roadmapItem.findUnique({ where: { id }, select: { projectId: true } });
  if (!item) return { error: "Item not found." };
  const ctx = await loadEditableProject(item.projectId);
  if (!ctx) return { error: "You don't have permission to edit this project." };

  const title = String(formData.get("title") ?? "").trim();
  const parsed = parseDate(formData);
  if (!title || !parsed) return { error: "A title and a date are required." };

  const assigneeIds = [...new Set((formData.getAll("assignees") as string[]).filter(Boolean))];
  await ensureMembers(item.projectId, assigneeIds);

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

  revalidateProject(item.projectId);
  return { success: true };
}

export async function deleteRoadmapItemAction(formData: FormData) {
  const id = String(formData.get("id"));
  const item = await prisma.roadmapItem.findUnique({ where: { id }, select: { projectId: true } });
  if (!item) return;
  const ctx = await loadEditableProject(item.projectId);
  if (!ctx) return;
  await prisma.roadmapItem.delete({ where: { id } });
  revalidateProject(item.projectId);
}

export async function toggleRoadmapItemDoneAction(formData: FormData) {
  const id = String(formData.get("id"));
  const item = await prisma.roadmapItem.findUnique({ where: { id }, select: { projectId: true, done: true } });
  if (!item) return;
  const ctx = await loadEditableProject(item.projectId);
  if (!ctx) return;
  await prisma.roadmapItem.update({ where: { id }, data: { done: !item.done } });
  revalidateProject(item.projectId);
}

export async function addRoadmapCommentAction(_prev: RoadmapFormState, formData: FormData): Promise<RoadmapFormState> {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write something first." };

  const item = await prisma.roadmapItem.findUnique({ where: { id }, select: { projectId: true } });
  if (!item) return { error: "Item not found." };
  // Looser gate than editing: anyone who can see the project can comment.
  const visible = await getProjectDetail(user, item.projectId);
  if (!visible) return { error: "You don't have access to this project." };

  await prisma.roadmapComment.create({ data: { itemId: id, authorId: user.id, body } });
  revalidatePath(`/projects/${item.projectId}/roadmap`);
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
  const item = await prisma.roadmapItem.findUnique({ where: { id }, select: { projectId: true } });
  if (!item) return;
  const ctx = await loadEditableProject(item.projectId);
  if (!ctx) return;
  await prisma.roadmapItem.update({ where: { id }, data: { date: new Date(dateRaw) } });
  revalidateProject(item.projectId);
}
