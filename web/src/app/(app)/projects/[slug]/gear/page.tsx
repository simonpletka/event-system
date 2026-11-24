import { notFound } from "next/navigation";
import { requireUser, canManageGear } from "@/lib/authz";
import { getProjectDetail, resolveProjectIdByNumber } from "@/lib/queries/projects";
import { gearToday, getGearBatches, getGearTypeOptions, getReservableProjects } from "@/lib/queries/gear";
import { parseProjectSlug } from "@/lib/slug";
import { formatCurrency } from "@/lib/format";
import { getLocale, getDictionary } from "@/lib/i18n";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReserveButton } from "@/components/gear/ReserveButton";
import { GearBatchCard } from "@/components/gear/GearBatchCard";

export default async function ProjectGearTab({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const number = parseProjectSlug(slug);
  if (!number) notFound();
  const id = await resolveProjectIdByNumber(number);
  if (!id) notFound();
  const project = await getProjectDetail(user, id);
  if (!project) notFound();

  const locale = await getLocale();
  const t = getDictionary(locale).gear;
  const canManage = canManageGear(user);
  const [batches, types, projects] = await Promise.all([
    getGearBatches({ projectId: id }),
    canManage ? getGearTypeOptions() : Promise.resolve([]),
    canManage ? getReservableProjects(user) : Promise.resolve([]),
  ]);
  const total = batches.reduce((sum, b) => sum + b.cost, 0);
  // The project may be closed and so missing from the picker; keep it selectable here.
  const pickable = projects.some((p) => p.id === id) ? projects : [{ id, title: project.title, companyName: project.companyName }, ...projects];

  return (
    <div className="gear-scope">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        {batches.length > 0 ? (
          <p className="text-[13px]">
            <span className="placeholder-text">{t.projectTotal}: </span>
            <span className="font-bold tabular-nums">{formatCurrency(total)}</span>
          </p>
        ) : (
          <span />
        )}
        {canManage && (
          <ReserveButton
            label={t.reserveForProject}
            className="btn shrink-0"
            locale={locale}
            projects={pickable}
            initialProjectId={id}
            types={types}
            initialLines={[]}
            today={gearToday()}
          />
        )}
      </div>

      {batches.length === 0 && <EmptyState message={t.projectEmpty} />}
      <div className="space-y-4">
        {batches.map((b) => (
          <GearBatchCard key={b.batchId} batch={b} showProject={false} canRelease={canManage} locale={locale} />
        ))}
      </div>
    </div>
  );
}
