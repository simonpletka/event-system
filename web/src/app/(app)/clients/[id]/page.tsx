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
      <BackLink href="/clients">Clients</BackLink>
      <div className="flex justify-between items-end border-b-2 border-ink pb-2 flex-wrap gap-2">
        <div className="text-[2.5rem] font-semibold leading-none">{client.name}</div>
        {canManage && (
          <Link href={`/clients/${client.id}/edit`} className="btno">
            Edit
          </Link>
        )}
      </div>

      <div className="grid grid-cols-[1fr_260px] gap-4 mt-3">
        <div>
          <div className="label">Events ({client.events.length})</div>
          {client.events.length === 0 && <p className="text-sm placeholder-text mt-1">No events linked yet.</p>}
          {client.events.map((e) => (
            <Link
              key={e.id}
              href={`/events/${e.id}`}
              className="group grid grid-cols-[1.4fr_1fr_.8fr_.8fr] gap-2.5 items-center py-2 border-b border-ink/13 text-[13px] hover:bg-ink/5"
            >
              <div className="group-hover:text-accent">{e.title}</div>
              <div className="placeholder-text group-hover:!text-accent">{formatDateRange(e.startDate, e.endDate)}</div>
              <div className="placeholder-text group-hover:!text-accent">{formatCurrency(e.quotedValue)}</div>
              <EventStatusPill status={e.status} />
            </Link>
          ))}

          <div className="rule-thin my-3.5" />

          <div className="flex items-center justify-between mb-1.5">
            <div className="label">Contacts</div>
            {canManage && <AddContactButton clientId={client.id} />}
          </div>
          {client.contacts.length === 0 && <p className="text-sm placeholder-text">No contacts added yet.</p>}
          {client.contacts.map((contact) => (
            <div key={contact.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2.5 items-center py-2 border-b border-ink/10 text-[13px]">
              <div>{contact.name}</div>
              <div className="placeholder-text">{contact.role || "—"}</div>
              <div className="placeholder-text">{contact.phone || "—"}</div>
              <div className="placeholder-text truncate">{contact.email || "—"}</div>
              {canManage && (
                <form action={deleteClientContactAction}>
                  <input type="hidden" name="id" value={contact.id} />
                  <input type="hidden" name="clientId" value={client.id} />
                  <button type="submit" className="text-[9px] tracking-[0.1em] uppercase placeholder-text hover:text-accent">
                    Remove
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>

        <div className="border-l border-ink/20 pl-3">
          <div className="label">Address</div>
          <p className="text-[13px] mt-1">{client.address || "—"}</p>

          <div className="rule-thin my-2.5" />
          <div className="label">IČO</div>
          <p className="text-[13px] mt-1">{client.ico || "—"}</p>

          <div className="rule-thin my-2.5" />
          <div className="label">DIČ</div>
          <p className="text-[13px] mt-1">{client.dic || "—"}</p>

          <div className="rule-thin my-2.5" />
          <div className="label">Invoicing email</div>
          <p className="text-[13px] mt-1">{client.invoicingEmail || "—"}</p>

          {client.note && (
            <>
              <div className="rule-thin my-2.5" />
              <div className="label">Note</div>
              <p className="text-[13px] mt-1 whitespace-pre-wrap">{client.note}</p>
            </>
          )}

          <div className="rule-thin my-2.5" />
          <div className="label">Total charged</div>
          <div className="text-lg font-semibold mt-0.5">{formatCurrency(client.totalCharged)}</div>
          <div className="placeholder-text text-[9px]">across {client.events.length} event{client.events.length === 1 ? "" : "s"}</div>

          {isAdmin(user) && (
            <>
              <div className="rule-thin my-2.5" />
              <div className="label mb-1.5">Delete</div>
              <p className="text-[10px] placeholder-text mb-2">
                Events linked to this client keep their own data — they just lose the link.
              </p>
              <ConfirmDeleteButton
                action={deleteClientAction}
                fields={{ id: client.id }}
                label="Delete client"
                confirmMessage={`Delete "${client.name}"? This can't be undone.`}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
