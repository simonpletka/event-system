import { notFound } from "next/navigation";
import { requireUser, canManageUsers } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { EditUserForm } from "@/components/settings/EditUserForm";
import { BackLink } from "@/components/BackLink";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!canManageUsers(user)) {
    return (
      <div>
        <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">Edit account</h1>
        <p className="text-sm placeholder-text">You don&apos;t have permission to manage users.</p>
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
      <BackLink href="/settings">Settings</BackLink>
      <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">Edit {target.name}</h1>
      <EditUserForm
        id={target.id}
        name={target.name}
        email={target.email}
        isCardHolder={target.isCardHolder}
        role={target.role}
        customRoleId={target.customRoleId}
        active={target.active}
        isSelf={target.id === user.id}
        customRoles={customRoles}
      />
    </div>
  );
}
