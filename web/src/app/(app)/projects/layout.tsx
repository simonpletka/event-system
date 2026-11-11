import { requireUser, canCreateProject } from "@/lib/authz";
import { ProjectsHeader } from "@/components/projects/ProjectsHeader";
import { getLocale } from "@/lib/i18n";

/** Holds the list header so the Table/Calendar highlight stays mounted and can slide when the view changes. */
export default async function ProjectsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const locale = await getLocale();

  return (
    <div className="projects-scope">
      <ProjectsHeader canCreate={canCreateProject(user)} locale={locale} />
      {children}
    </div>
  );
}
