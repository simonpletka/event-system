import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getStudioWorks } from "@/lib/queries/studio";
import { STUDIO_APPS } from "@/lib/studio";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatPragueDate } from "@/lib/prague-date";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function StudioPage() {
  const user = await requireUser();
  const locale = await getLocale();
  const t = getDictionary(locale).studio;
  const works = await getStudioWorks(user);
  const when = (d: Date) => formatPragueDate(d, locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div>
      <PageHeader>
        <div className="max-w-[1080px]">
          <h1 className="text-[48px] font-bold tracking-tight">{t.title}</h1>
          <p className="text-[13px] placeholder-text max-w-prose">{t.intro}</p>
        </div>
      </PageHeader>
      <div className="max-w-[1080px] mt-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STUDIO_APPS.map((app) => (
            <Link key={app.slug} href={`/studio/${app.slug}`} className="card p-5 flex flex-col gap-2 hover:border-accent/50 group">
              <span className="text-[17px] font-semibold group-hover:text-accent">{t.apps[app.slug].name}</span>
              <span className="text-[13px] placeholder-text flex-1">{t.apps[app.slug].description}</span>
              <span className="text-[11px] placeholder-text">{t.worksCount(works.filter((w) => w.app === app.slug).length)}</span>
            </Link>
          ))}
        </div>

        <section className="card p-5">
          <h2 className="heading-label !text-[12px] mb-2">{t.recentWork}</h2>
          {works.length === 0 ? (
            <p className="text-[13px] placeholder-text">{t.noWorkYet}</p>
          ) : (
            <ul>
              {works.slice(0, 20).map((w) => (
                <li key={w.id} className="border-t border-ink/8 first:border-t-0">
                  <Link href={`/studio/${w.app}?work=${w.id}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2.5 group">
                    <span className="font-semibold group-hover:text-accent">{w.title}</span>
                    <span className="text-[12px] placeholder-text">{t.apps[w.app as keyof typeof t.apps]?.name ?? w.app}</span>
                    {w.project && <span className="text-[12px] placeholder-text">{`${w.project.number} · ${w.project.title}`}</span>}
                    <span className="text-[12px] placeholder-text ml-auto">
                      {when(w.updatedAt)}
                      {w.createdBy && ` · ${t.by(w.createdBy.name)}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
