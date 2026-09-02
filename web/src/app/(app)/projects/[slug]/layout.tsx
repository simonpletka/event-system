import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canEditProject, isAdmin, canViewProjectBudget } from "@/lib/authz";
import { getProjectDetail, resolveProjectIdByNumber } from "@/lib/queries/projects";
import { parseProjectSlug, projectHref, clientHref } from "@/lib/slug";
import { notionPageUrl } from "@/lib/notion";
import { formatDateRange } from "@/lib/format";
import { ProjectStatusPill } from "@/components/StatusPill";
import { ProjectTabs } from "@/components/ProjectTabs";
import { BackLink } from "@/components/BackLink";
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
        <BackLink href="/projects">{t.projects.backToProjects}</BackLink>
        <div className="flex justify-between items-end flex-wrap gap-2 mt-2">
          <div>
            <div className="text-[19px] md:text-[24px] font-bold tracking-tight">
              <span className="placeholder-text font-medium">{project.number}</span> {project.title}
            </div>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] mt-1.5">
              <span className="placeholder-text">
                {project.clientId ? (
                  <Link href={clientHref({ id: project.clientId, name: project.companyName })} className="hover:text-accent">
                    {project.companyName}
                  </Link>
                ) : (
                  project.companyName
                )}{" "}
                · {formatDateRange(project.startDate, project.endDate)}
                {project.venues[0] ? ` · ${project.venues[0].name}` : ""}
              </span>
              <ProjectStatusPill status={project.status} t={t.statusProject} />
            </div>
          </div>
          <div className="flex gap-1.5 items-center">
            {project.notionPageId && (
              <Link
                href={notionPageUrl(project.notionPageId)}
                target="_blank"
                rel="noopener noreferrer"
                className="btno"
              >
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
