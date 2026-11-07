import { notFound } from "next/navigation";
import { requireUser, canEditProject } from "@/lib/authz";
import { getProjectDetail, resolveProjectIdByNumber } from "@/lib/queries/projects";
import { prisma } from "@/lib/prisma";
import { parseProjectSlug } from "@/lib/slug";
import { getLocale } from "@/lib/i18n";
import { ProjectFiles } from "@/components/projects/ProjectFiles";

export default async function FilesTab({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const number = parseProjectSlug(slug);
  if (!number) notFound();
  const id = await resolveProjectIdByNumber(number);
  if (!id) notFound();
  const project = await getProjectDetail(user, id);
  if (!project) notFound();

  const files = await prisma.projectFile.findMany({
    where: { projectId: id },
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <ProjectFiles
      projectId={id}
      files={files.map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        addedAt: f.createdAt.toISOString(),
        addedBy: f.uploadedBy.name,
      }))}
      editable={canEditProject(user, { ownerId: project.ownerId, memberIds: project.members.map((m) => m.userId) })}
      locale={await getLocale()}
    />
  );
}
