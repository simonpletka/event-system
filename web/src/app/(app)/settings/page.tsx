import Link from "next/link";
import { requireUser, canManageUsers, canManageCompanySettings } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getCompanySettings } from "@/lib/queries/finance";
import { UsersTable } from "@/components/settings/UsersTable";
import { CreateUserForm } from "@/components/settings/CreateUserForm";
import { CompanySettingsForm } from "@/components/settings/CompanySettingsForm";
import { RoleReferenceTable } from "@/components/settings/RoleReferenceTable";
import { RolesTab } from "@/components/settings/RolesTab";
import { CategoriesTab } from "@/components/settings/CategoriesTab";
import { getItemCategories } from "@/lib/actions/categories";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const canUsers = canManageUsers(user);
  const canCompany = canManageCompanySettings(user);
  const tab = (params.tab as "users" | "roles" | "company" | "categories") || (canUsers ? "users" : "company");

  if (!canUsers && !canCompany) {
    return (
      <div>
        <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">Settings</h1>
        <div className="heading-label mb-1">Signed in as</div>
        <div className="text-sm mb-4">
          {user.name} <span className="placeholder-text">· {user.email} · {user.role}</span>
        </div>
        <p className="text-sm placeholder-text max-w-prose">You don&apos;t have access to broader settings — that&apos;s Admin/Accountant territory.</p>
      </div>
    );
  }

  const [users, company, customRoles, categories] = await Promise.all([
    canUsers ? prisma.user.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
    getCompanySettings(),
    canUsers
      ? prisma.customRole.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { users: true } } } })
      : Promise.resolve([]),
    canCompany ? getItemCategories() : Promise.resolve([]),
  ]);
  const roleRows = customRoles.map((r) => ({ ...r, userCount: r._count.users }));

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-6 -mt-5 px-6 pt-5 pb-2 backdrop-blur-2xl bg-gradient-to-b from-bg/80 to-bg/50 border-b border-ink/10">
        <div className="flex items-end justify-between">
          <div>
            <div className="heading-label">{users.length ? `${users.length} accounts` : "Company settings"}</div>
            <h1 className="text-[28px] font-bold tracking-tight mt-1">Settings</h1>
          </div>
        </div>

        <div className="flex gap-3.5 mt-3">
          {canUsers && (
            <>
              <Link
                href="/settings?tab=users"
                className={`text-[9px] tracking-[0.14em] uppercase pb-2 border-b-2 ${tab === "users" ? "border-accent text-accent" : "border-transparent placeholder-text hover:text-ink"}`}
              >
                Users &amp; roles
              </Link>
              <Link
                href="/settings?tab=roles"
                className={`text-[9px] tracking-[0.14em] uppercase pb-2 border-b-2 ${tab === "roles" ? "border-accent text-accent" : "border-transparent placeholder-text hover:text-ink"}`}
              >
                Custom roles
              </Link>
            </>
          )}
          {canCompany && (
            <>
              <Link
                href="/settings?tab=company"
                className={`text-[9px] tracking-[0.14em] uppercase pb-2 border-b-2 ${tab === "company" ? "border-accent text-accent" : "border-transparent placeholder-text hover:text-ink"}`}
              >
                Company
              </Link>
              <Link
                href="/settings?tab=categories"
                className={`text-[9px] tracking-[0.14em] uppercase pb-2 border-b-2 ${tab === "categories" ? "border-accent text-accent" : "border-transparent placeholder-text hover:text-ink"}`}
              >
                Categories
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="mt-5">
        {tab === "users" && canUsers && (
          <div>
            <CreateUserForm customRoles={customRoles} />
            <div className="rule-thin my-4" />
            <UsersTable users={users} customRoles={customRoles} currentUserId={user.id} />
            <div className="rule-thin my-4" />
            <RoleReferenceTable customRoles={roleRows} />
          </div>
        )}
        {tab === "roles" && canUsers && <RolesTab roles={roleRows} />}
        {tab === "company" && canCompany && <CompanySettingsForm defaults={company} />}
        {tab === "categories" && canCompany && <CategoriesTab categories={categories} />}
      </div>
    </div>
  );
}
