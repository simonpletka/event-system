import { notFound } from "next/navigation";
import { requireUser, canManageClients } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { ClientForm } from "@/components/ClientForm";
import { BackLink } from "@/components/BackLink";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) notFound();

  return (
    <div>
      <BackLink href={`/clients/${id}`}>{client.name}</BackLink>
      <h1 className="text-[28px] font-bold tracking-tight border-b border-ink/14 pb-4 mb-5 mt-2">Edit {client.name}</h1>
      {!canManageClients(user) ? (
        <p className="text-sm placeholder-text">You don&apos;t have permission to edit clients.</p>
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
        />
      )}
    </div>
  );
}
