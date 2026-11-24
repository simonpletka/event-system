import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canManageGear } from "@/lib/authz";
import { getLocale, getDictionary } from "@/lib/i18n";
import { getGearCategories, getGearTypeDetail, getGearTypeOptions, getReservableProjects } from "@/lib/queries/gear";
import { deleteGearTypeAction } from "@/lib/actions/gear";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { GEAR_TYPE_FORM_ID, GearTypeForm } from "@/components/gear/GearTypeForm";
import { GearUnitsCard } from "@/components/gear/GearUnitsCard";
import { ReserveButton } from "@/components/gear/ReserveButton";

export default async function GearItemPage({ params }: { params: Promise<{ typeId: string }> }) {
  const user = await requireUser();
  const { typeId } = await params;
  const [type, categories] = await Promise.all([getGearTypeDetail(typeId), getGearCategories()]);
  if (!type) notFound();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.gear;
  const canManage = canManageGear(user);
  const [types, projects] = canManage ? await Promise.all([getGearTypeOptions(), getReservableProjects(user)]) : [[], []];
  const activeUnits = type.units.filter((u) => u.active).length;

  return (
    <div className="gear-scope">
      <PageHeader>
        <div className="max-w-[1180px] flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <Link href="/gear" className="inline-block text-[12px] placeholder-text hover:text-accent">
              ← {t.backToGear}
            </Link>
            <h1 className="text-[34px] md:text-[40px] font-bold tracking-tight leading-tight mt-1 break-words">{type.name}</h1>
            <p className="text-[14px] placeholder-text">{t.metaLine(type.categoryName, activeUnits)}</p>
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-1.5">
              <ReserveButton
                label={t.reserve}
                locale={locale}
                projects={projects}
                types={types}
                initialLines={[{ typeId: type.id, quantity: 1 }]}
                today={type.today}
              />
              <button type="submit" form={GEAR_TYPE_FORM_ID} className="btn font-semibold hidden lg:inline-flex">
                {t.saveChanges}
              </button>
            </div>
          )}
        </div>
      </PageHeader>

      <div className="max-w-[1180px] mt-6">
        <GearTypeForm
          mode="edit"
          values={type}
          categories={categories}
          canManage={canManage}
          locale={locale}
          left={<GearUnitsCard typeId={type.id} units={type.units} days={type.days} today={type.today} canManage={canManage} locale={locale} />}
          right={
            <>
              <section aria-label={t.usedInGroups} className="card p-5 md:p-6">
                <h2 className="text-[20px] font-bold mb-2">{t.usedInGroups}</h2>
                {type.groups.length === 0 ? (
                  <p className="text-[13px] placeholder-text">{t.notInGroups}</p>
                ) : (
                  <ul>
                    {type.groups.map((g) => (
                      <li key={g.id} className="border-t border-ink/10">
                        <Link href={`/gear/groups?group=${g.id}`} className="flex justify-between py-3 text-[14.5px] hover:text-accent">
                          <span>{g.name}</span>
                          <span className="placeholder-text tabular-nums">{g.quantity}×</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {canManage &&
                (type.hasReservations ? (
                  <p className="text-[12.5px] placeholder-text px-1">{t.typeHasReservations}</p>
                ) : (
                  <ConfirmDeleteButton
                    action={deleteGearTypeAction}
                    fields={{ id: type.id }}
                    confirmMessage={t.deleteTypeConfirm(type.name)}
                    label={t.deleteType}
                    pendingLabel={dict.common.deleting}
                    className="btno self-start !border-warning text-warning"
                  />
                ))}
            </>
          }
        />
      </div>
    </div>
  );
}
