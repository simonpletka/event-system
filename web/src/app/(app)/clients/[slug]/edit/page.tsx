import { notFound } from "next/navigation";
import { parseClientSlug } from "@/lib/slug";
import { requireUser, canManageClients } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { ClientForm } from "@/components/ClientForm";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function EditClientPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const id = parseClientSlug(slug);
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) notFound();
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <div className="max-w-3xl">
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
