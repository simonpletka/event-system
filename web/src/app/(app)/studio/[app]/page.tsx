import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { canEditStudioWork, getStudioProjectOptions, getStudioWork, getStudioWorks } from "@/lib/queries/studio";
import { studioApp } from "@/lib/studio";
import { StudioHost } from "@/components/studio/StudioHost";
import { getLocale } from "@/lib/i18n";

export default async function StudioAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ app: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const app = studioApp((await params).app);
  if (!app) notFound();
  const query = await searchParams;
  const locale = await getLocale();

  const [works, projects, work] = await Promise.all([
    getStudioWorks(user, { app: app.slug }),
    getStudioProjectOptions(user),
    query.work ? getStudioWork(user, query.work) : null,
  ]);
  const opened = work && work.app === app.slug ? work : null;

  return (
    <StudioHost
      // A different work, or a new one, starts the app again from scratch.
      key={opened?.id ?? (query.new ? "new" : "local")}
      slug={app.slug}
      locale={locale}
      works={works.map((w) => ({
        id: w.id,
        title: w.title,
        project: w.project ? `${w.project.number} · ${w.project.title}` : null,
        updatedAt: w.updatedAt.toISOString(),
      }))}
      projects={projects}
      work={
        opened
          ? {
              id: opened.id,
              title: opened.title,
              projectId: opened.projectId,
              data: opened.data,
              updatedAt: opened.updatedAt.toISOString(),
              editable: canEditStudioWork(user, opened),
            }
          : null
      }
      startNew={Boolean(query.new) && !opened}
      initialProjectId={projects.some((p) => p.id === query.project) ? query.project! : null}
    />
  );
}
