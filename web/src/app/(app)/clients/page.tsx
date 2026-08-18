import Link from "next/link";
import { requireUser, canManageClients } from "@/lib/authz";
import { getClientList } from "@/lib/queries/clients";
import { formatCurrency } from "@/lib/format";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const clients = await getClientList(user, params.q);
  const canManage = canManageClients(user);

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-6 -mt-5 px-6 pt-5 pb-4 backdrop-blur-2xl bg-gradient-to-b from-bg/80 to-bg/50 border-b border-ink/10">
        <div className="flex items-end justify-between">
          <div>
            <div className="heading-label">{clients.length} clients</div>
            <h1 className="text-[28px] font-bold tracking-tight mt-1">Clients</h1>
          </div>
          {canManage && (
            <Link href="/clients/new" className="btn">
              New client
            </Link>
          )}
        </div>

        <form method="get" className="flex gap-1.5 mt-4">
          <input name="q" defaultValue={params.q ?? ""} placeholder="Search by name…" className="input text-[12px] py-2 w-[240px]" />
          <button type="submit" className="btno text-[9px]">
            Apply
          </button>
        </form>
      </div>

      <div className="grid grid-cols-[1.5fr_.8fr_.7fr_.7fr_1fr] gap-2.5 border-b border-ink/14 pb-1.5 mt-5 px-3.5">
        <span className="heading-label">Company</span>
        <span className="heading-label">IČO</span>
        <span className="heading-label">Contacts</span>
        <span className="heading-label">Events</span>
        <span className="heading-label">Total charged</span>
      </div>

      {clients.length === 0 && <p className="text-sm placeholder-text mt-4">No clients yet.</p>}

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
  );
}
