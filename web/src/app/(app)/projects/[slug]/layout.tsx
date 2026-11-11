import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canEditProject, isAdmin, canViewProjectBudget } from "@/lib/authz";
import { getProjectDetail, resolveProjectIdByNumber } from "@/lib/queries/projects";
import { parseProjectSlug, projectHref, clientHref } from "@/lib/slug";
import { notionPageUrl } from "@/lib/notion";
import { driveFolderUrl } from "@/lib/gdrive";
import { formatPragueRange } from "@/lib/prague-date";
import { ProjectStatusChip } from "@/components/projects/ProjectStatusChip";
import { BackToProjects } from "@/components/projects/BackToProjects";
import { ProjectTabs } from "@/components/ProjectTabs";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import { deleteProjectAction } from "@/lib/actions/projects";
import { PageHeader } from "@/components/ui/PageHeader";
import { MobileStickyTabs } from "@/components/ui/MobileStickyTabs";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function EventDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;
  const number = parseProjectSlug(slug);
  if (!number) notFound();
  const id = await resolveProjectIdByNumber(number);
  if (!id) notFound();
  const project = await getProjectDetail(user, id);
  if (!project) notFound();
  const locale = await getLocale();
  const t = getDictionary(locale);

  const editable = canEditProject(user, { ownerId: project.ownerId, memberIds: project.members.map((m) => m.userId) });

  return (
    <div>
      <PageHeader pb="pb-2">
        <div className="max-w-6xl">
        <BackToProjects label={t.projects.backToProjects} />
        <div className="flex justify-between items-end flex-wrap gap-3 mt-2">
          <div className="min-w-0">
            <div className="text-[2.5rem] font-medium leading-none placeholder-text">{project.number}</div>
            <h1 className="text-[2.5rem] font-semibold leading-tight break-words">{project.title}</h1>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] mt-1.5">
              <span className="placeholder-text">
                {project.clientId ? (
                  <Link href={clientHref({ id: project.clientId, name: project.companyName })} className="hover:text-accent">
                    {project.companyName}
                  </Link>
                ) : (
                  project.companyName
                )}{" "}
                · {formatPragueRange(project.startDate, project.endDate, locale)}
                {project.venues[0] ? ` · ${project.venues[0].name}` : ""}
              </span>
              <ProjectStatusChip status={project.status} t={t.statusProject} />
            </div>
          </div>
          <div className="flex gap-1.5 items-center flex-wrap">
            {project.driveFolderId && (
              <Link href={driveFolderUrl(project.driveFolderId)} target="_blank" rel="noopener noreferrer" className="btno">
                {t.projects.driveFolder}
              </Link>
            )}
            {project.notionPageId && (
              <Link href={notionPageUrl(project.notionPageId)} target="_blank" rel="noopener noreferrer" className="btno">
                {t.projects.notionPage}
              </Link>
            )}
            {editable && (
              <Link href={projectHref(project, "/edit")} className="btno">
                {t.projects.editProject}
              </Link>
            )}
            {isAdmin(user) && (
              <DeleteProjectButton
                action={deleteProjectAction}
                projectId={project.id}
                projectTitle={project.title}
                expenseCount={project.expenses.length}
                invoiceCount={project.invoices.length}
                locale={locale}
              />
            )}
          </div>
        </div>

        <div className="hidden md:block mt-2.5">
          <ProjectTabs project={project} showFinance={canViewProjectBudget(user)} locale={locale} />
        </div>
        </div>
      </PageHeader>

      <MobileStickyTabs>
        <ProjectTabs project={project} showFinance={canViewProjectBudget(user)} locale={locale} />
      </MobileStickyTabs>

      <div className="mt-4 md:mt-7 max-w-6xl">{children}</div>
    </div>
  );
}
