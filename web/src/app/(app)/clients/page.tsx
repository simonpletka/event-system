import Link from "next/link";
import { requireUser, canManageClients } from "@/lib/authz";
import { getClientList } from "@/lib/queries/clients";
import { formatCurrency } from "@/lib/format";
import { MobileListRow } from "@/components/ui/MobileListRow";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const clients = await getClientList(user, params.q);
  const canManage = canManageClients(user);
  const t = getDictionary(await getLocale());
  const tc = t.clients;

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-6 mt-0 md:-mt-5 px-6 pt-5 pb-4 backdrop-blur-2xl bg-gradient-to-b from-bg/80 to-bg/50 border-b border-ink/10">
        <div className="flex items-end justify-between">
          <div>
            <div className="heading-label">{tc.countHeading(clients.length)}</div>
            <h1 className="text-[28px] font-bold tracking-tight mt-1">{tc.title}</h1>
          </div>
          {canManage && (
            <Link href="/clients/new" className="btn font-semibold">
              {tc.newClient}
            </Link>
          )}
        </div>

        <form method="get" className="flex gap-1.5 mt-4">
          <input name="q" defaultValue={params.q ?? ""} placeholder={tc.searchPlaceholder} className="input text-[12px] py-2 w-[240px]" />
          <button type="submit" className="btno text-[9px]">
            {tc.apply}
          </button>
        </form>
      </div>

      <div className="hidden md:block">
        <div className="grid grid-cols-[1.5fr_.8fr_.7fr_.7fr_1fr] gap-2.5 border-b border-ink/14 pb-1.5 mt-5 px-3.5">
          <span className="heading-label">{tc.colCompany}</span>
          <span className="heading-label">{tc.colIco}</span>
          <span className="heading-label">{tc.colContacts}</span>
          <span className="heading-label">{tc.colEvents}</span>
          <span className="heading-label">{tc.colTotalCharged}</span>
        </div>

        {clients.map((c) => (
          <Link
            key={c.id}
            href={`/clients/${c.id}`}
            className="group grid grid-cols-[1.5fr_.8fr_.7fr_.7fr_1fr] gap-2.5 items-center py-3 px-3.5 rounded-xl border-b border-ink/8 last:border-b-0 text-[13px] hover:bg-ink/5"
          >
            <div className="font-medium group-hover:text-accent">{c.name}</div>
            <div className="placeholder-text group-hover:!text-accent">{c.ico || "—"}</div>
            <div className="placeholder-text group-hover:!text-accent">{c.contactCount}</div>
            <div className="placeholder-text group-hover:!text-accent">{c.eventCount}</div>
            <div className="font-semibold tabular-nums group-hover:text-accent">{formatCurrency(c.totalCharged)}</div>
          </Link>
        ))}
      </div>

      <div className="md:hidden flex flex-col gap-2 mt-4">
        {clients.map((c) => (
          <MobileListRow
            key={c.id}
            href={`/clients/${c.id}`}
            title={c.name}
            meta={`${tc.colIco}: ${c.ico || "—"} · ${c.contactCount} ${tc.colContacts} · ${c.eventCount} ${tc.colEvents}`}
            trailing={formatCurrency(c.totalCharged)}
          />
        ))}
      </div>

      {clients.length === 0 && <p className="text-sm placeholder-text mt-4">{tc.noClientsYet}</p>}
    </div>
  );
}
