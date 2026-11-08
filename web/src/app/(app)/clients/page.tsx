import Link from "next/link";
import { requireUser, canManageClients } from "@/lib/authz";
import { getClientList } from "@/lib/queries/clients";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ClientsList } from "@/components/clients/ClientsList";
import { getLocale, getDictionary } from "@/lib/i18n";
import { clientHref } from "@/lib/slug";

export default async function ClientsPage() {
  const user = await requireUser();
  const locale = await getLocale();
  const clients = await getClientList(user);
  const canManage = canManageClients(user);
  const tc = getDictionary(locale).clients;

  return (
    <div>
      <PageHeader>
        <div className="max-w-[1080px] flex items-end justify-between gap-3 flex-wrap">
          <h1 className="text-[46px] md:text-[60px] font-bold tracking-tight">{tc.title}</h1>
          {canManage && (
            <Link href="/clients/new" className="btn font-semibold">
              {tc.newClient}
            </Link>
          )}
        </div>
      </PageHeader>

      <div className="max-w-[1080px] mt-7">
        {clients.length === 0 ? (
          <EmptyState message={tc.noClientsYet} actionLabel={canManage ? tc.newClient : undefined} actionHref="/clients/new" />
        ) : (
          <ClientsList clients={clients.map((c) => ({ ...c, href: clientHref(c) }))} locale={locale} />
        )}
      </div>
    </div>
  );
}
