import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canManageClients, isAdmin } from "@/lib/authz";
import { getClientDetail } from "@/lib/queries/clients";
import { formatCurrency, formatDateRange } from "@/lib/format";
import { deleteClientContactAction, deleteClientAction } from "@/lib/actions/clients";
import { BackLink } from "@/components/BackLink";
import { EventStatusPill } from "@/components/StatusPill";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { AddContactButton } from "@/components/AddContactModal";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const client = await getClientDetail(user, id);
  if (!client) notFound();

  const canManage = canManageClients(user);

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-6 -mt-5 px-6 pt-5 pb-4 backdrop-blur-2xl bg-gradient-to-b from-bg/80 to-bg/50 border-b border-ink/10">
        <BackLink href="/clients">Clients</BackLink>
        <div className="flex justify-between items-end flex-wrap gap-2 mt-2">
          <div className="text-[2.5rem] font-semibold leading-none">{client.name}</div>
          {canManage && (
            <Link href={`/clients/${client.id}/edit`} className="btno">
              Edit
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_300px] gap-5 mt-5">
        <div>
          <div className="heading-label">Events ({client.events.length})</div>
          {client.events.length === 0 && <p className="text-sm placeholder-text mt-2">No events linked yet.</p>}
          <div className="mt-1.5">
            {client.events.map((e) => (
              <Link
                key={e.id}
                href={`/events/${e.id}`}
                className="group grid grid-cols-[1.4fr_1fr_.8fr_.8fr] gap-2.5 items-center py-2.5 px-2.5 rounded-lg border-b border-ink/8 last:border-b-0 text-[13px] hover:bg-ink/5"
              >
                <div className="font-medium group-hover:text-accent">{e.title}</div>
                <div className="placeholder-text group-hover:!text-accent">{formatDateRange(e.startDate, e.endDate)}</div>
                <div className="font-semibold tabular-nums group-hover:text-accent">{formatCurrency(e.quotedValue)}</div>
                <EventStatusPill status={e.status} />
              </Link>
            ))}
          </div>

          <div className="h-px bg-ink/10 my-5" />

          <div className="flex items-center justify-between mb-2">
            <div className="heading-label">Contacts</div>
            {canManage && <AddContactButton clientId={client.id} />}
          </div>
          {client.contacts.length === 0 && <p className="text-sm placeholder-text">No contacts added yet.</p>}
          {client.contacts.map((contact) => (
            <div key={contact.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2.5 items-center py-2.5 px-2.5 border-b border-ink/8 last:border-b-0 text-[13px]">
              <div className="font-medium">{contact.name}</div>
              <div className="placeholder-text">{contact.role || "—"}</div>
              <div className="placeholder-text">{contact.phone || "—"}</div>
              <div className="placeholder-text truncate">{contact.email || "—"}</div>
              {canManage && (
                <form action={deleteClientContactAction}>
                  <input type="hidden" name="id" value={contact.id} />
                  <input type="hidden" name="clientId" value={client.id} />
                  <button type="submit" className="text-[9px] tracking-[0.1em] uppercase placeholder-text hover:text-warning">
                    Remove
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>

        <div className="card p-5 self-start">
          <div className="heading-label">Address</div>
          <p className="text-[13px] mt-1.5">{client.address || "—"}</p>

          <div className="h-px bg-ink/8 my-3.5" />
          <div className="heading-label">IČO</div>
          <p className="text-[13px] mt-1.5">{client.ico || "—"}</p>

          <div className="h-px bg-ink/8 my-3.5" />
          <div className="heading-label">DIČ</div>
          <p className="text-[13px] mt-1.5">{client.dic || "—"}</p>

          <div className="h-px bg-ink/8 my-3.5" />
          <div className="heading-label">Invoicing email</div>
          <p className="text-[13px] mt-1.5">{client.invoicingEmail || "—"}</p>

          {client.note && (
            <>
              <div className="h-px bg-ink/8 my-3.5" />
              <div className="heading-label">Note</div>
              <p className="text-[13px] mt-1.5 whitespace-pre-wrap">{client.note}</p>
            </>
          )}

          <div className="h-px bg-ink/8 my-3.5" />
          <div className="heading-label">Total charged</div>
          <div className="text-2xl font-semibold tracking-tight mt-1.5">{formatCurrency(client.totalCharged)}</div>
          <div className="placeholder-text text-[10px] mt-0.5">across {client.events.length} event{client.events.length === 1 ? "" : "s"}</div>

          {isAdmin(user) && (
            <>
              <div className="h-px bg-ink/8 my-3.5" />
              <div className="heading-label mb-2">Delete</div>
              <p className="text-[10px] placeholder-text mb-2.5">
                Events linked to this client keep their own data — they just lose the link.
              </p>
              <ConfirmDeleteButton
                action={deleteClientAction}
                fields={{ id: client.id }}
                label="Delete client"
                confirmMessage={`Delete "${client.name}"? This can't be undone.`}
                className="btno !border-warning text-warning w-full text-center"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
