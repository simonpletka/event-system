import { notFound } from "next/navigation";
import { requireUser, canManageClients } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { ClientForm } from "@/components/ClientForm";
import { BackLink } from "@/components/BackLink";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) notFound();
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <div>
      <BackLink href={`/clients/${id}`}>{client.name}</BackLink>
      <h1 className="text-[28px] font-bold tracking-tight border-b border-ink/14 pb-4 mb-5 mt-2">{t.clients.editClientH1(client.name)}</h1>
      {!canManageClients(user) ? (
        <p className="text-lg font-semibold text-ink">{t.clients.noPermEdit}</p>
      ) : (
        <ClientForm
          defaults={{
            id: client.id,
            name: client.name,
            street: client.street,
            city: client.city,
            postCode: client.postCode,
            state: client.state,
            ico: client.ico,
            dic: client.dic,
            note: client.note,
            invoicingEmail: client.invoicingEmail,
          }}
          locale={locale}
        />
      )}
    </div>
  );
}
