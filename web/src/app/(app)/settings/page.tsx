import Link from "next/link";
import { requireUser, canManageUsers, canManageCompanySettings, getFreshUserFields, isAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getCompanySettings } from "@/lib/queries/finance";
import { getLocale, getDictionary } from "@/lib/i18n";
import { getAppColors } from "@/lib/theme";
import { PageHeader } from "@/components/ui/PageHeader";
import { MobileStickyTabs } from "@/components/ui/MobileStickyTabs";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { UsersTable } from "@/components/settings/UsersTable";
import { CreateUserForm } from "@/components/settings/CreateUserForm";
import { GeneralSettingsForm } from "@/components/settings/GeneralSettingsForm";
import { CompanySettingsForm } from "@/components/settings/CompanySettingsForm";
import { RoleReferenceTable } from "@/components/settings/RoleReferenceTable";
import { CategoriesTab } from "@/components/settings/CategoriesTab";
import { AppSettingsForm } from "@/components/settings/AppSettingsForm";
import { InvoiceEmailingForm } from "@/components/settings/InvoiceEmailingForm";
import { ConnectorTab } from "@/components/settings/ConnectorTab";
import { TravelTab } from "@/components/settings/TravelTab";
import { getCarsharingPlans, getUserVehicles } from "@/lib/queries/trips";
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
    (params.tab as "general" | "company" | "users" | "templates" | "invoiceEmailing" | "appSettings" | "claude" | "travel") || "general";
  const canConnector = isAdmin(user);

  const [users, company, customRoles, categories, freshUser, vehicles, plans] = await Promise.all([
    canUsers ? prisma.user.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
    getCompanySettings(),
    canUsers
      ? prisma.customRole.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { users: true } } } })
      : Promise.resolve([]),
    canCompany ? getItemCategories() : Promise.resolve([]),
    getFreshUserFields(user.id),
    tab === "travel" ? getUserVehicles(user.id) : Promise.resolve([]),
    tab === "travel" && canCompany ? getCarsharingPlans() : Promise.resolve([]),
  ]);
  const roleRows = customRoles.map((r) => ({ ...r, userCount: r._count.users }));
  const colors = getAppColors(company);

  // Eyebrow describes the tab you're actually on — not a fixed value keyed
  // to permissions (which showed "N accounts" above the General tab).
  const tabEyebrow =
    tab === "users" && canUsers
      ? t.settings.accountsCount(users.length)
      : tab === "company"
        ? t.settings.tabCompany
        : tab === "templates"
          ? t.settings.tabTemplates
          : tab === "invoiceEmailing"
            ? t.settings.tabInvoiceEmailing
            : tab === "appSettings"
              ? t.settings.tabAppSettings
              : tab === "claude"
                ? t.connector.eyebrow
                : tab === "travel"
                  ? t.settings.tabTravel
                  : t.settings.general.accountHeading;

  const tabLinks = [
    { key: "general", href: "/settings?tab=general", label: t.settings.tabGeneral, show: true },
    { key: "travel", href: "/settings?tab=travel", label: t.settings.tabTravel, show: true },
    { key: "company", href: "/settings?tab=company", label: t.settings.tabCompany, show: canCompany },
    { key: "users", href: "/settings?tab=users", label: t.settings.tabUsers, show: canUsers },
    { key: "templates", href: "/settings?tab=templates", label: t.settings.tabTemplates, show: canCompany },
    { key: "invoiceEmailing", href: "/settings?tab=invoiceEmailing", label: t.settings.tabInvoiceEmailing, show: canCompany },
    { key: "appSettings", href: "/settings?tab=appSettings", label: t.settings.tabAppSettings, show: canCompany },
    { key: "claude", href: "/settings?tab=claude", label: t.connector.tab, show: canConnector },
  ].filter((x) => x.show);

  const tabNav = (
    <div className="flex gap-3.5 flex-wrap">
      {tabLinks.map((x) => (
        <Link
          key={x.key}
          href={x.href}
          className={`shrink-0 text-[10px] tracking-[0.14em] uppercase pb-2 border-b-2 ${tab === x.key ? "border-accent text-accent" : "border-transparent placeholder-text hover:text-ink"}`}
        >
          {x.label}
        </Link>
      ))}
    </div>
  );

  return (
    <div>
      <PageHeader pb="pb-2">
        <div className="max-w-3xl">
        <div className="flex items-end justify-between">
          <div>
            <div className="heading-label">{tabEyebrow}</div>
            <h1 className="text-[46px] md:text-[60px] font-bold tracking-tight mt-1">{t.settings.title}</h1>
          </div>
        </div>

        <div className="hidden md:block mt-3">{tabNav}</div>
        </div>
      </PageHeader>

      <MobileStickyTabs>
        <SegmentedTabs options={tabLinks.map((x) => ({ value: x.key, href: x.href, label: x.label }))} active={tab} />
      </MobileStickyTabs>

      <div className="mt-5 max-w-3xl">
        {tab === "general" && (
          <GeneralSettingsForm
            defaults={{
              name: freshUser?.name ?? user.name ?? "",
              email: freshUser?.email ?? user.email ?? "",
              phone: freshUser?.phone ?? "",
              avatarPath: freshUser?.avatarPath ?? null,
            }}
            currentLocale={freshUser?.locale === "cs" || freshUser?.locale === "en" ? freshUser.locale : null}
            locale={locale}
          />
        )}
        {tab === "travel" && <TravelTab vehicles={vehicles} plans={plans} canEditPlans={canCompany} locale={locale} />}
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
            }}
            t={t.settings.appSettings}
          />
        )}
        {tab === "claude" && canConnector && <ConnectorTab t={t.connector} />}
      </div>
    </div>
  );
}
