import Link from "next/link";
import { STUDIO_APPS } from "@/lib/studio";
import { formatPragueDate } from "@/lib/prague-date";
import { getDictionary, type Locale } from "@/lib/dictionary";

/** The project's Studio work on its Files tab: open each one, or start a new one already linked to the project. */
export function ProjectStudioWorks({
  projectId,
  works,
  canAdd,
  locale,
}: {
  projectId: string;
  works: { id: string; app: string; title: string; updatedAt: Date; createdBy: { name: string } | null }[];
  canAdd: boolean;
  locale: Locale;
}) {
  const t = getDictionary(locale).studio;
  const appName = (app: string) => t.apps[app as keyof typeof t.apps]?.name ?? app;
  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
        <h2 className="heading-label !text-[12px]">{t.projectSection}</h2>
        {canAdd && (
          <div className="flex flex-wrap gap-1.5">
            {STUDIO_APPS.map((app) => (
              <Link key={app.slug} href={`/studio/${app.slug}?new=1&project=${projectId}`} className="btno !text-[10px] !px-3 !py-1">
                {t.newIn(t.apps[app.slug].name)}
              </Link>
            ))}
          </div>
        )}
      </div>
      <p className="text-[12px] placeholder-text mb-2">{t.projectSectionNote}</p>
      {works.length === 0 ? (
        <p className="text-[13px] placeholder-text">{t.noWorkYet}</p>
      ) : (
        <ul>
          {works.map((w) => (
            <li key={w.id} className="border-t border-ink/8 first:border-t-0">
              <Link href={`/studio/${w.app}?work=${w.id}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2.5 group">
                <span className="font-semibold group-hover:text-accent">{w.title}</span>
                <span className="text-[12px] placeholder-text">{appName(w.app)}</span>
                <span className="text-[12px] placeholder-text ml-auto">
                  {formatPragueDate(w.updatedAt, locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  {w.createdBy && ` · ${t.by(w.createdBy.name)}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
