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
      <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">Edit {client.name}</h1>
      {!canManageClients(user) ? (
        <p className="text-sm placeholder-text">You don&apos;t have permission to edit clients.</p>
      ) : (
        <ClientForm
          defaults={{
            id: client.id,
            name: client.name,
            address: client.address,
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
