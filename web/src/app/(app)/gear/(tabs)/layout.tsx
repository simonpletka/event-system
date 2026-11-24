import { requireUser, canManageGear } from "@/lib/authz";
import { getLocale } from "@/lib/i18n";
import { getGearTypeCount } from "@/lib/queries/gear";
import { getOpenGearIssueCount } from "@/lib/queries/gear-ops";
import { PageHeader } from "@/components/ui/PageHeader";
import { MobileStickyTabs } from "@/components/ui/MobileStickyTabs";
import { GearHeader, GearTabs } from "@/components/gear/GearHeader";

export default async function GearTabsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const locale = await getLocale();
  const [typeCount, openIssues] = await Promise.all([getGearTypeCount(), getOpenGearIssueCount()]);

  return (
    <div className="gear-scope">
      <PageHeader pb="pb-2">
        <div className="max-w-[1180px]">
          <GearHeader locale={locale} typeCount={typeCount} canManage={canManageGear(user)} />
          <div className="hidden md:block mt-3">
            <GearTabs locale={locale} openIssues={openIssues} />
          </div>
        </div>
      </PageHeader>
      <MobileStickyTabs>
        <GearTabs locale={locale} openIssues={openIssues} />
      </MobileStickyTabs>
      <div className="mt-4 md:mt-6 max-w-[1180px]">{children}</div>
    </div>
  );
}
