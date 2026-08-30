import { requireUser } from "@/lib/authz";
import { getLocale, getDictionary } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { TimeTrackerTabs } from "@/components/TimeTrackerTabs";

export default async function TimeTrackerLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <div>
      <PageHeader pb="pb-2">
        <h1 className="text-[28px] font-bold tracking-tight">{t.timeTracker.title}</h1>
        <div className="mt-3 md:hidden">
          <TimeTrackerTabs locale={locale} />
        </div>
      </PageHeader>
      <div className="mt-4">{children}</div>
    </div>
  );
}
