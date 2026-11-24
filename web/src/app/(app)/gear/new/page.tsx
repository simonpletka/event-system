import Link from "next/link";
import { requireUser, canManageGear } from "@/lib/authz";
import { getLocale, getDictionary } from "@/lib/i18n";
import { getGearCategories } from "@/lib/queries/gear";
import { DEFAULT_RATE_PERCENT } from "@/lib/gear-pricing";
import { PageHeader } from "@/components/ui/PageHeader";
import { GearTypeForm } from "@/components/gear/GearTypeForm";

export default async function NewGearPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const t = getDictionary(locale).gear;
  const categories = await getGearCategories();
  const { category } = await searchParams;

  return (
    <div className="gear-scope">
      <PageHeader>
        <div className="max-w-[1180px]">
          <Link href="/gear" className="inline-block text-[12px] placeholder-text hover:text-accent">
            ← {t.backToGear}
          </Link>
          <h1 className="text-[34px] md:text-[40px] font-bold tracking-tight mt-1">{t.newGear}</h1>
        </div>
      </PageHeader>
      <div className="max-w-[1180px] mt-6">
        {!canManageGear(user) ? (
          <p className="text-[15px] font-semibold">{t.noPermission}</p>
        ) : categories.length === 0 ? (
          <p className="text-[14px]">
            {t.empty}{" "}
            <Link href="/gear" className="text-accent font-semibold">
              {t.addCategory}
            </Link>
          </p>
        ) : (
          <GearTypeForm
            mode="new"
            values={{
              id: "",
              name: "",
              categoryId: categories.some((c) => c.id === category) ? category! : "",
              notes: "",
              purchasePrice: 0,
              rateMode: "AUTO",
              ratePercent: DEFAULT_RATE_PERCENT,
              customDayRate: null,
            }}
            categories={categories}
            canManage
            locale={locale}
            right={
              <button type="submit" form="gear-type-form" className="btn font-semibold min-h-[44px] hidden lg:inline-flex self-start">
                {t.createGear}
              </button>
            }
          />
        )}
      </div>
    </div>
  );
}
