import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, canEditProject, projectWhereForUser } from "@/lib/authz";
import { saveProjectFile } from "@/lib/uploads";
import { MAX_PROJECT_FILE_MB } from "@/lib/project-files";
import { projectHref } from "@/lib/slug";

/** One file per request. A route handler, not a server action: those cap the request body at 1MB. */
export async function POST(req: Request) {
  const user = await requireUser();
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "No file." }, { status: 400 });
  if (file.size > MAX_PROJECT_FILE_MB * 1024 * 1024) return NextResponse.json({ error: "File too large." }, { status: 413 });

  const project = await prisma.project.findFirst({
    where: { id: String(formData.get("projectId")), ...projectWhereForUser(user) },
    include: { members: true },
  });
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  if (!canEditProject(user, { ownerId: project.ownerId, memberIds: project.members.map((m) => m.userId) })) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const storedName = await saveProjectFile(file);
  await prisma.projectFile.create({
    data: { projectId: project.id, uploadedById: user.id, name: file.name, storedName, size: file.size },
  });
  revalidatePath(projectHref(project, "/files"));
  return NextResponse.json({ ok: true });
}
