import { requireUser, canManageClients } from "@/lib/authz";
import { ClientForm } from "@/components/ClientForm";

export default async function NewClientPage() {
  const user = await requireUser();

  return (
    <div>
      <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">New client</h1>
      {!canManageClients(user) ? (
        <p className="text-sm placeholder-text">You don&apos;t have permission to add clients.</p>
      ) : (
        <ClientForm defaults={{ name: "", address: "", ico: "", dic: "", note: "", invoicingEmail: "" }} />
      )}
    </div>
  );
}
