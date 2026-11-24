import { requireUser, canManageGear } from "@/lib/authz";
import { getLocale } from "@/lib/i18n";
import { getGearCatalog } from "@/lib/queries/gear";
import { GearCatalog } from "@/components/gear/GearCatalog";

export default async function GearCatalogPage() {
  const user = await requireUser();
  const locale = await getLocale();
  const { categories, rows } = await getGearCatalog();
  return <GearCatalog categories={categories} rows={rows} canManage={canManageGear(user)} locale={locale} />;
}
