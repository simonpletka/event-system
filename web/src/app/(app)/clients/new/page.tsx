import { requireUser, canManageClients } from "@/lib/authz";
import { ClientForm } from "@/components/ClientForm";

export default async function NewClientPage() {
  const user = await requireUser();

  return (
    <div>
      <h1 className="text-[28px] font-bold tracking-tight border-b border-ink/14 pb-4 mb-5">New client</h1>
      {!canManageClients(user) ? (
        <p className="text-sm placeholder-text">You don&apos;t have permission to add clients.</p>
      ) : (
        <ClientForm defaults={{ name: "", address: "", ico: "", dic: "", note: "", invoicingEmail: "" }} />
      )}
    </div>
  );
}
