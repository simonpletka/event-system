"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canEditProject } from "@/lib/authz";
import { canEditStudioWork, getStudioWork } from "@/lib/queries/studio";
import { studioApp, STUDIO_MAX_DATA } from "@/lib/studio";
import { projectHref } from "@/lib/slug";

export type StudioSaveResult = { ok: boolean; id?: string; error?: string };

function revalidateStudio(app: string, project: { number: string; title: string } | null) {
  revalidatePath("/studio");
  revalidatePath(`/studio/${app}`);
  if (project) revalidatePath(projectHref(project, "/files"));
}

/** Saves the app's work: updates `id` when given, otherwise creates a new one. */
export async function saveStudioWorkAction(formData: FormData): Promise<StudioSaveResult> {
  const user = await requireUser();
  const app = studioApp(String(formData.get("app") ?? ""));
  if (!app) return { ok: false, error: "Unknown app." };

  const data = String(formData.get("data") ?? "");
  if (!data || data.length > STUDIO_MAX_DATA) return { ok: false, error: "The work is empty or too large to save." };
  try {
    JSON.parse(data);
  } catch {
    return { ok: false, error: "The app returned something that isn't its project data." };
  }
  const title = String(formData.get("title") ?? "").trim().slice(0, 200) || "Untitled";

  const projectId = String(formData.get("projectId") ?? "") || null;
  const project = projectId ? await prisma.project.findUnique({ where: { id: projectId }, include: { members: true } }) : null;
  if (projectId && (!project || !canEditProject(user, { ownerId: project.ownerId, memberIds: project.members.map((m) => m.userId) }))) {
    return { ok: false, error: "You can't link work to that project." };
  }

  const id = String(formData.get("id") ?? "");
  let saved: { id: string };
  if (id) {
    const existing = await getStudioWork(user, id);
    if (!existing || existing.app !== app.slug) return { ok: false, error: "That work no longer exists." };
    if (!canEditStudioWork(user, existing)) return { ok: false, error: "You can't change this work. Save it as new instead." };
    saved = await prisma.studioWork.update({ where: { id }, data: { title, data, projectId } });
    if (existing.projectId && existing.projectId !== projectId) {
      const previous = await prisma.project.findUnique({ where: { id: existing.projectId }, select: { number: true, title: true } });
      if (previous) revalidatePath(projectHref(previous, "/files"));
    }
  } else {
    saved = await prisma.studioWork.create({ data: { app: app.slug, title, data, projectId, createdById: user.id } });
  }

  revalidateStudio(app.slug, project);
  return { ok: true, id: saved.id };
}

export async function deleteStudioWorkAction(formData: FormData) {
  const user = await requireUser();
  const work = await getStudioWork(user, String(formData.get("id") ?? ""));
  if (!work || !canEditStudioWork(user, work)) return;
  const project = work.projectId ? await prisma.project.findUnique({ where: { id: work.projectId }, select: { number: true, title: true } }) : null;
  await prisma.studioWork.delete({ where: { id: work.id } });
  revalidateStudio(work.app, project);
  redirect(`/studio/${work.app}`);
}
