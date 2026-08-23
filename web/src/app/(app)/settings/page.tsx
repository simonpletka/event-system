import Link from "next/link";
import { requireUser, canManageUsers, canManageCompanySettings } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getCompanySettings } from "@/lib/queries/finance";
import { getLocale, getDictionary } from "@/lib/i18n";
import { getAppColors } from "@/lib/theme";
import { UsersTable } from "@/components/settings/UsersTable";
import { CreateUserForm } from "@/components/settings/CreateUserForm";
import { CompanySettingsForm } from "@/components/settings/CompanySettingsForm";
import { RoleReferenceTable } from "@/components/settings/RoleReferenceTable";
import { CategoriesTab } from "@/components/settings/CategoriesTab";
import { AppSettingsForm } from "@/components/settings/AppSettingsForm";
import { InvoiceEmailingForm } from "@/components/settings/InvoiceEmailingForm";
import {
  DEFAULT_INVOICE_EMAIL_SUBJECT,
  DEFAULT_INVOICE_EMAIL_BODY,
  DEFAULT_REMINDER_EMAIL_SUBJECT,
  DEFAULT_REMINDER_EMAIL_BODY,
} from "@/lib/email-templates";
import { getItemCategories } from "@/lib/actions/categories";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale);

  const canUsers = canManageUsers(user);
  const canCompany = canManageCompanySettings(user);
  const tab =
    (params.tab as "company" | "users" | "templates" | "invoiceEmailing" | "appSettings") || (canCompany ? "company" : "users");

  if (!canUsers && !canCompany) {
    return (
      <div>
        <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">{t.settings.title}</h1>
        <div className="heading-label mb-1">{t.settings.signedInAs}</div>
        <div className="text-sm mb-4">
          {user.name} <span className="placeholder-text">· {user.email} · {user.role}</span>
        </div>
        <p className="text-sm placeholder-text max-w-prose">{t.settings.noAccessMsg}</p>
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
  const colors = getAppColors(company);

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-6 mt-0 md:-mt-5 px-6 pt-5 pb-2 backdrop-blur-2xl bg-gradient-to-b from-bg/80 to-bg/50 border-b border-ink/10">
        <div className="flex items-end justify-between">
          <div>
            <div className="heading-label">{users.length ? t.settings.accountsCount(users.length) : t.settings.companySettingsLabel}</div>
            <h1 className="text-[28px] font-bold tracking-tight mt-1">{t.settings.title}</h1>
          </div>
        </div>

        <div className="flex gap-3.5 mt-3 flex-nowrap overflow-x-auto pb-1 md:pb-0 md:flex-wrap md:overflow-visible">
          {canCompany && (
            <Link
              href="/settings?tab=company"
              className={`shrink-0 text-[9px] tracking-[0.14em] uppercase pb-2 border-b-2 ${tab === "company" ? "border-accent text-accent" : "border-transparent placeholder-text hover:text-ink"}`}
            >
              {t.settings.tabCompany}
            </Link>
          )}
          {canUsers && (
            <Link
              href="/settings?tab=users"
              className={`shrink-0 text-[9px] tracking-[0.14em] uppercase pb-2 border-b-2 ${tab === "users" ? "border-accent text-accent" : "border-transparent placeholder-text hover:text-ink"}`}
            >
              {t.settings.tabUsers}
            </Link>
          )}
          {canCompany && (
            <Link
              href="/settings?tab=templates"
              className={`shrink-0 text-[9px] tracking-[0.14em] uppercase pb-2 border-b-2 ${tab === "templates" ? "border-accent text-accent" : "border-transparent placeholder-text hover:text-ink"}`}
            >
              {t.settings.tabTemplates}
            </Link>
          )}
          {canCompany && (
            <Link
              href="/settings?tab=invoiceEmailing"
              className={`shrink-0 text-[9px] tracking-[0.14em] uppercase pb-2 border-b-2 ${tab === "invoiceEmailing" ? "border-accent text-accent" : "border-transparent placeholder-text hover:text-ink"}`}
            >
              {t.settings.tabInvoiceEmailing}
            </Link>
          )}
          {canCompany && (
            <Link
              href="/settings?tab=appSettings"
              className={`shrink-0 text-[9px] tracking-[0.14em] uppercase pb-2 border-b-2 ${tab === "appSettings" ? "border-accent text-accent" : "border-transparent placeholder-text hover:text-ink"}`}
            >
              {t.settings.tabAppSettings}
            </Link>
          )}
        </div>
      </div>

      <div className="mt-5">
        {tab === "company" && canCompany && <CompanySettingsForm defaults={company} t={t.settings.company} />}
        {tab === "users" && canUsers && (
          <div>
            <CreateUserForm customRoles={customRoles} locale={locale} tRoles={t.roles} tRoleSelect={t.settings.roleSelect} />
            <div className="rule-thin my-4" />
            <UsersTable users={users} customRoles={customRoles} currentUserId={user.id} locale={locale} tRoles={t.roles} />
            <div className="rule-thin my-4" />
            <RoleReferenceTable customRoles={roleRows} canManage={canUsers} locale={locale} tAccess={t.accessLevels} tRoles={t.roles} />
          </div>
        )}
        {tab === "templates" && canCompany && (
          <div>
            <div className="heading-label !text-[12px] mb-2">{t.settings.quoteHeading}</div>
            <CategoriesTab categories={categories} locale={locale} />
          </div>
        )}
        {tab === "invoiceEmailing" && canCompany && (
          <InvoiceEmailingForm
            defaults={{
              invoiceEmailSubject: company?.invoiceEmailSubject ?? DEFAULT_INVOICE_EMAIL_SUBJECT,
              invoiceEmailBody: company?.invoiceEmailBody ?? DEFAULT_INVOICE_EMAIL_BODY,
              reminderEmailSubject: company?.reminderEmailSubject ?? DEFAULT_REMINDER_EMAIL_SUBJECT,
              reminderEmailBody: company?.reminderEmailBody ?? DEFAULT_REMINDER_EMAIL_BODY,
            }}
            locale={locale}
          />
        )}
        {tab === "appSettings" && canCompany && (
          <AppSettingsForm
            defaults={{
              bgColor: colors.bg,
              surfaceColor: colors.surface,
              inkColor: colors.ink,
              accentColor: colors.accent,
              positiveColor: colors.positive,
              warningColor: colors.warning,
              locale,
            }}
            t={t.settings.appSettings}
          />
        )}
      </div>
    </div>
  );
}
