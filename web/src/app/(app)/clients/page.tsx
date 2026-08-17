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
      <div className="flex items-end justify-between border-b-2 border-ink pb-2">
        <div>
          <div className="heading-label">{clients.length} clients</div>
          <h1 className="text-xl font-semibold">Clients</h1>
        </div>
        {canManage && (
          <Link href="/clients/new" className="btn">
            New client
          </Link>
        )}
      </div>

      <form method="get" className="flex gap-1.5 mt-3">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search by name…"
          className="border border-ink/35 bg-transparent px-2 py-1.5 text-[9px] w-[220px]"
        />
        <button type="submit" className="btno text-[9px]">
          Apply
        </button>
      </form>

      <div className="grid grid-cols-[1.5fr_.8fr_.7fr_.7fr_1fr] gap-2.5 border-b-2 border-ink pb-1.5 mt-3">
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
          className="grid grid-cols-[1.5fr_.8fr_.7fr_.7fr_1fr] gap-2.5 items-center py-2.5 border-b border-ink/13 text-[13px] hover:bg-ink/5"
        >
          <div>{c.name}</div>
          <div className="placeholder-text">{c.ico || "—"}</div>
          <div className="placeholder-text">{c.contactCount}</div>
          <div className="placeholder-text">{c.eventCount}</div>
          <div>{formatCurrency(c.totalCharged)}</div>
        </Link>
      ))}
    </div>
  );
}
