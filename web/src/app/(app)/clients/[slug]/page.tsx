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
          <Link href="/clients" className="inline-block text-[12px] placeholder-text hover:text-accent mt-1">
            ← {tc.backLink}
          </Link>
          <div className="flex justify-between items-end flex-wrap gap-3 mt-2">
            <div className="min-w-0">
              <h1 className="text-[2.5rem] font-semibold leading-none break-words">{client.name}</h1>
              <p className="text-[13px] placeholder-text mt-2">
                {tc.icoHeading} {client.ico || "—"}
              </p>
            </div>
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

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_300px] gap-5 mt-7 max-w-6xl">
        <div className="flex flex-col gap-5 min-w-0">
          <section aria-label={tc.contactsHeading} className="card p-4 md:p-5">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 className="heading-label !text-[12px] font-bold">{tc.contactsHeading}</h2>
              {canManage && <AddContactButton clientId={client.id} t={tc.addContact} />}
            </div>
            {client.contacts.length === 0 ? (
              <p className="text-[13px] placeholder-text py-2">{tc.noContactsAdded}</p>
            ) : (
              <ul className="flex flex-col">
                {client.contacts.map((contact) => (
                  <li
                    key={contact.id}
                    className="flex items-start md:items-center justify-between gap-3 py-3 border-t border-ink/8 first:border-t-0"
                  >
                    <div className="min-w-0 flex-1 md:grid md:grid-cols-[1.1fr_.9fr_.9fr_1.2fr] md:gap-2.5 md:items-center text-[15px]">
                      <div className="font-medium break-words">{contact.name}</div>
                      <div className="placeholder-text text-[13px] md:text-[15px]">{contact.role || "—"}</div>
                      <div className="placeholder-text text-[13px] md:text-[15px]">
                        {contact.phone ? (
                          <a href={`tel:${contact.phone.replace(/\s+/g, "")}`} className="hover:text-accent whitespace-nowrap">
                            {contact.phone}
                          </a>
                        ) : (
                          "—"
                        )}
                      </div>
                      <div className="placeholder-text text-[13px] md:text-[15px] min-w-0 truncate">
                        {contact.email ? (
                          <a href={`mailto:${contact.email}`} className="hover:text-accent">
                            {contact.email}
                          </a>
                        ) : (
                          "—"
                        )}
                      </div>
                    </div>
                    {canManage && (
                      <ConfirmDeleteButton
                        action={deleteClientContactAction}
                        fields={{ id: contact.id, clientId: client.id }}
                        confirmMessage={tc.confirmRemoveContact(contact.name)}
                        label={tc.remove}
                        className="shrink-0 text-[9px] tracking-[0.1em] uppercase placeholder-text hover:text-warning py-1"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label={tc.projectsHeading(client.projects.length)} className="card p-4 md:p-5">
            <h2 className="heading-label !text-[12px] font-bold mb-2">{tc.projectsHeading(client.projects.length)}</h2>
            {client.projects.length === 0 && <p className="text-[13px] placeholder-text py-2">{tc.noProjectsLinked}</p>}
            <div className="hidden md:block">
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
            <div className="md:hidden flex flex-col gap-2">
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
          </section>
        </div>

        <section aria-label={tc.detailsHeading} className="card p-5 self-start min-w-0">
          <h2 className="heading-label !text-[12px] font-bold mb-3">{tc.detailsHeading}</h2>
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
        </section>
      </div>
    </div>
  );
}
