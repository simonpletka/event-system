import { notFound } from "next/navigation";
import { requireUser, canManageUsers } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getLocale, getDictionary } from "@/lib/i18n";
import { EditUserForm } from "@/components/settings/EditUserForm";
import { BackLink } from "@/components/BackLink";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const t = getDictionary(locale);

  if (!canManageUsers(user)) {
    return (
      <div>
        <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">{t.settings.users.editAccount}</h1>
        <p className="text-lg font-semibold text-ink">{t.settings.users.noPermManageUsers}</p>
      </div>
    );
  }

  const { id } = await params;
  const [target, customRoles] = await Promise.all([
    prisma.user.findUnique({ where: { id } }),
    prisma.customRole.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!target) notFound();

  return (
    <div>
      <BackLink href="/settings">{t.settings.users.settingsBackLink}</BackLink>
      <h1 className="text-[28px] font-bold tracking-tight border-b border-ink/14 pb-4 mb-5 mt-2">{t.settings.users.editName(target.name)}</h1>
      <EditUserForm
        id={target.id}
        name={target.name}
        email={target.email}
        phone={target.phone}
        isCardHolder={target.isCardHolder}
        role={target.role}
        customRoleId={target.customRoleId}
        active={target.active}
        isSelf={target.id === user.id}
        customRoles={customRoles}
        t={t.settings.editUser}
        tRoles={t.roles}
        tRoleSelect={t.settings.roleSelect}
        tCommon={t.common}
      />
    </div>
  );
}
