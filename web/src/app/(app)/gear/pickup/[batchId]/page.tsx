import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canManageGear, canHandleGearPickup } from "@/lib/authz";
import { getLocale, getDictionary } from "@/lib/i18n";
import { getGearBatchChecklist } from "@/lib/queries/gear-ops";
import { projectHref } from "@/lib/slug";
import { PageHeader } from "@/components/ui/PageHeader";
import { PickupChecklist } from "@/components/gear/PickupChecklist";
import { formatDayRange } from "@/components/gear/shared";

/** One reservation as a pick-up and return checklist: every unit of a group booking together. */
export default async function GearPickupPage({ params }: { params: Promise<{ batchId: string }> }) {
  const user = await requireUser();
  const { batchId } = await params;
  const batch = await getGearBatchChecklist(user, batchId);
  if (!batch) notFound();
  const locale = await getLocale();
  const t = getDictionary(locale).gear;
  const canHandle = canHandleGearPickup(user, batch.projectAccess);
  const back = batch.project ? projectHref(batch.project, "/gear") : "/gear/reservations";

  return (
    <div className="gear-scope">
      <PageHeader>
        <div className="max-w-[760px]">
          <Link href={back} className="inline-block text-[12px] placeholder-text hover:text-accent">
            ← {batch.project ? `${batch.project.number} ${batch.project.title}` : t.backToReservations}
          </Link>
          <h1 className="text-[30px] md:text-[36px] font-bold tracking-tight mt-1">{t.checklistTitle}</h1>
          <p className="text-[14px] placeholder-text">
            {batch.groupName ?? t.individualGear} · {formatDayRange(batch.startDate, batch.endDate, locale)}
            {batch.note ? ` · ${batch.note}` : ""}
          </p>
        </div>
      </PageHeader>
      <section aria-label={t.checklistTitle} className="card p-5 max-w-[760px] mt-6">
        <PickupChecklist rows={batch.rows} canHandle={canHandle} canManage={canManageGear(user)} locale={locale} big />
      </section>
    </div>
  );
}
