import { requireUser, canManageClients } from "@/lib/authz";
import { ClientForm } from "@/components/ClientForm";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function NewClientPage() {
  const user = await requireUser();
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <div>
      <h1 className="text-[28px] font-bold tracking-tight border-b border-ink/14 pb-4 mb-5">{t.clients.newClientH1}</h1>
      {!canManageClients(user) ? (
        <p className="text-lg font-semibold text-ink">{t.clients.noPermAdd}</p>
      ) : (
        <ClientForm defaults={{ name: "", street: "", city: "", postCode: "", state: "", ico: "", dic: "", note: "", invoicingEmail: "" }} locale={locale} />
      )}
    </div>
  );
}
