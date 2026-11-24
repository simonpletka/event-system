import { requireUser, canManageGear } from "@/lib/authz";
import { getLocale } from "@/lib/i18n";
import { getGearCatalog } from "@/lib/queries/gear";
import { getGearAttention } from "@/lib/queries/gear-ops";
import { GearCatalog } from "@/components/gear/GearCatalog";
import { AttentionBox } from "@/components/gear/AttentionBox";

export default async function GearCatalogPage() {
  const user = await requireUser();
  const locale = await getLocale();
  const [{ categories, rows }, attention] = await Promise.all([getGearCatalog(), getGearAttention(user)]);
  const canManage = canManageGear(user);
  return (
    <div className="flex flex-col gap-4">
      <AttentionBox affected={attention.affected} overdue={attention.overdue} canManage={canManage} locale={locale} />
      <GearCatalog categories={categories} rows={rows} canManage={canManage} locale={locale} />
    </div>
  );
}
