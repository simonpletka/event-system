import Link from "next/link";
import { notFound } from "next/navigation";
import { parseClientSlug, projectHref, clientHref } from "@/lib/slug";
import { requireUser, canManageClients, canCreateProject, isAdmin } from "@/lib/authz";
import { getClientDetail } from "@/lib/queries/clients";
import { formatCurrency, formatDateRange } from "@/lib/format";
import { deleteClientContactAction, deleteClientAction } from "@/lib/actions/clients";
import { ProjectStatusPill } from "@/components/StatusPill";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { AddContactButton } from "@/components/AddContactModal";
import { MobileListRow } from "@/components/ui/MobileListRow";
import { PageHeader } from "@/components/ui/PageHeader";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function ClientDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const id = parseClientSlug(slug);
  const client = await getClientDetail(user, id);
  if (!client) notFound();
  const t = getDictionary(await getLocale());
  const tc = t.clients;

  const canManage = canManageClients(user);

  return (
    <div>
      <PageHeader>
        <div className="max-w-6xl">
        <div className="flex justify-between items-end flex-wrap gap-2 mt-2">
          <div className="text-[2.5rem] font-semibold leading-none">{client.name}</div>
          <div className="flex gap-1.5 items-center">
            {canCreateProject(user) && (
              <Link href={`/projects/new?clientId=${client.id}`} className="btn font-semibold">
                {t.projects.newProject}
              </Link>
            )}
            {canManage && (
              <Link href={clientHref(client, "/edit")} className="btno">
                {tc.edit}
              </Link>
            )}
          </div>
        </div>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-5 mt-5 max-w-6xl">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="heading-label !text-[12px]">{tc.contactsHeading}</div>
            {canManage && <AddContactButton clientId={client.id} t={tc.addContact} />}
          </div>
          {client.contacts.length === 0 && <p className="text-sm placeholder-text">{tc.noContactsAdded}</p>}
          {client.contacts.map((contact) => (
            <div
              key={contact.id}
              className="hidden md:grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2.5 items-center py-3.5 px-2.5 border-b border-ink/8 last:border-b-0 text-[15px]"
            >
              <div className="font-medium">{contact.name}</div>
              <div className="placeholder-text">{contact.role || "—"}</div>
              <div className="placeholder-text">{contact.phone || "—"}</div>
              <div className="placeholder-text truncate">{contact.email || "—"}</div>
              {canManage && (
                <form action={deleteClientContactAction}>
                  <input type="hidden" name="id" value={contact.id} />
                  <input type="hidden" name="clientId" value={client.id} />
                  <button type="submit" className="text-[9px] tracking-[0.1em] uppercase placeholder-text hover:text-warning">
                    {tc.remove}
                  </button>
                </form>
              )}
            </div>
          ))}
          {client.contacts.map((contact) => (
            <div key={`m-${contact.id}`} className="md:hidden flex items-start justify-between gap-2.5 py-3 px-2.5 border-b border-ink/8 last:border-b-0 text-[13px]">
              <div className="min-w-0">
                <div className="font-medium">{contact.name}</div>
                <div className="placeholder-text text-[11.5px] mt-0.5">
                  {[contact.role, contact.phone, contact.email].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              {canManage && (
                <form action={deleteClientContactAction} className="shrink-0">
                  <input type="hidden" name="id" value={contact.id} />
                  <input type="hidden" name="clientId" value={client.id} />
                  <button type="submit" className="text-[9px] tracking-[0.1em] uppercase placeholder-text hover:text-warning py-1">
                    {tc.remove}
                  </button>
                </form>
              )}
            </div>
          ))}

          <div className="h-px bg-ink/10 my-5" />

          <div className="heading-label !text-[12px]">{tc.projectsHeading(client.projects.length)}</div>
          {client.projects.length === 0 && <p className="text-sm placeholder-text mt-2">{tc.noProjectsLinked}</p>}
          <div className="hidden md:block mt-1.5">
            {client.projects.length > 0 && (
              <div className="grid grid-cols-[1.4fr_1fr_.8fr_.8fr] gap-2.5 border-b border-ink/14 pb-1.5 px-2.5 [&_.heading-label]:font-bold [&_.heading-label]:!text-[9px]">
                <span className="heading-label">{t.projects.colProject}</span>
                <span className="heading-label">{tc.colDates}</span>
                <span className="heading-label">{t.projects.colValue}</span>
                <span className="heading-label">{t.projects.colStatus}</span>
              </div>
            )}
            {client.projects.map((e) => (
              <Link
                key={e.id}
                href={projectHref(e)}
                className="group grid grid-cols-[1.4fr_1fr_.8fr_.8fr] gap-2.5 items-center py-3.5 px-2.5 rounded-lg border-b border-ink/8 last:border-b-0 text-[15px] hover:bg-ink/5"
              >
                <div className="font-semibold group-hover:text-accent">{e.title}</div>
                <div className="placeholder-text group-hover:!text-accent">{formatDateRange(e.startDate, e.endDate)}</div>
                <div className="font-semibold tabular-nums group-hover:text-accent">{formatCurrency(e.quotedValue)}</div>
                <ProjectStatusPill status={e.status} t={t.statusProject} />
              </Link>
            ))}
          </div>

          <div className="md:hidden flex flex-col gap-2 mt-1.5">
            {client.projects.map((e) => (
              <MobileListRow
                key={e.id}
                href={projectHref(e)}
                title={e.title}
                tag={<ProjectStatusPill status={e.status} t={t.statusProject} />}
                meta={formatDateRange(e.startDate, e.endDate)}
                trailing={formatCurrency(e.quotedValue)}
              />
            ))}
          </div>
        </div>

        <div className="card p-5 self-start">
          <div className="heading-label">{tc.addressHeading}</div>
          {client.street || client.city || client.postCode || client.state ? (
            <p className="text-[13px] mt-1.5 leading-relaxed">
              {client.street && <>{client.street}<br /></>}
              {(client.postCode || client.city) && (
                <>
                  {[client.postCode, client.city].filter(Boolean).join(" ")}
                  <br />
                </>
              )}
              {client.state}
            </p>
          ) : (
            <p className="text-[13px] mt-1.5">—</p>
          )}

          <div className="h-px bg-ink/8 my-3.5" />
          <div className="heading-label">{tc.icoHeading}</div>
          <p className="text-[13px] mt-1.5">{client.ico || "—"}</p>

          <div className="h-px bg-ink/8 my-3.5" />
          <div className="heading-label">{tc.dicHeading}</div>
          <p className="text-[13px] mt-1.5">{client.dic || "—"}</p>

          <div className="h-px bg-ink/8 my-3.5" />
          <div className="heading-label">{tc.invoicingEmailHeading}</div>
          <p className="text-[13px] mt-1.5">{client.invoicingEmail || "—"}</p>

          {client.note && (
            <>
              <div className="h-px bg-ink/8 my-3.5" />
              <div className="heading-label">{tc.noteHeading}</div>
              <p className="text-[13px] mt-1.5 whitespace-pre-wrap">{client.note}</p>
            </>
          )}

          <div className="h-px bg-ink/8 my-3.5" />
          <div className="heading-label">{tc.totalChargedHeading}</div>
          <div className="text-2xl font-semibold tracking-tight mt-1.5">
            {formatCurrency(client.totalCharged)}
            {client.totalMixed && <span className="placeholder-text text-base align-top">&thinsp;*</span>}
          </div>
          <div className="placeholder-text text-[10px] mt-0.5">{tc.acrossProjects(client.projects.length)}</div>
          {client.totalMixed && <div className="placeholder-text text-[10px] mt-1">{tc.mixedCurrencyNote}</div>}

          {isAdmin(user) && (
            <>
              <div className="h-px bg-ink/8 my-3.5" />
              <div className="heading-label !text-[12px] mb-2">{tc.deleteHeading}</div>
              <p className="text-[10px] placeholder-text mb-2.5">{tc.deleteHelper}</p>
              <ConfirmDeleteButton
                action={deleteClientAction}
                fields={{ id: client.id }}
                label={tc.deleteClient}
                confirmMessage={tc.confirmDelete(client.name)}
                className="btno !border-warning text-warning w-full text-center"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
