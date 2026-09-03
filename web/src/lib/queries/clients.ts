import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/authz";
import { projectWhereForUser } from "@/lib/authz";
import { isMixedCurrencyTotal } from "@/lib/format";
import { toCzkBatch } from "@/lib/fx";

export async function getClientList(user: SessionUser, q?: string) {
  const clients = await prisma.client.findMany({
    where: q ? { name: { contains: q } } : undefined,
    include: {
      contacts: { select: { id: true } },
      projects: {
        where: projectWhereForUser(user),
        select: { id: true, invoices: { select: { subtotal: true, currency: true, issuedAt: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return Promise.all(
    clients.map(async (c) => {
      const invoices = c.projects.flatMap((e) => e.invoices);
      // Pre-VAT (subtotal, not total) — VAT is a pass-through liability, not
      // revenue. Non-CZK invoices convert to CZK at the CNB fixing rate on
      // their own issue date (see src/lib/fx.ts) rather than summing raw
      // cross-currency amounts. totalMixed still flags when a client's
      // invoices span more than one currency, now just as an FYI.
      const converted = await toCzkBatch(invoices.map((i) => ({ amount: i.subtotal, currency: i.currency, date: i.issuedAt })));
      return {
        id: c.id,
        name: c.name,
        ico: c.ico,
        contactCount: c.contacts.length,
        projectCount: c.projects.length,
        totalCharged: converted.reduce((s, i) => s + i.czkAmount, 0),
        totalMixed: isMixedCurrencyTotal(invoices.map((i) => i.currency)),
      };
    })
  );
}

export const getClientDetail = cache(async function getClientDetail(user: SessionUser, id: string) {
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: { name: "asc" } },
      projects: {
        where: projectWhereForUser(user),
        include: { invoices: { select: { id: true, number: true, total: true, subtotal: true, currency: true, status: true, issuedAt: true } } },
        orderBy: { startDate: "desc" },
      },
    },
  });
  if (!client) return null;

  const allInvoices = client.projects.flatMap((e) => e.invoices);
  const converted = await toCzkBatch(allInvoices.map((i) => ({ amount: i.subtotal, currency: i.currency, date: i.issuedAt })));
  const totalCharged = converted.reduce((s, i) => s + i.czkAmount, 0);
  const totalMixed = isMixedCurrencyTotal(allInvoices.map((i) => i.currency));
  return { ...client, totalCharged, totalMixed };
});

/**
 * For ProjectForm's client picker — deliberately unscoped by projectWhereForUser
 * (picking a client isn't the same as seeing their projects). Includes the
 * full company fields, not just id/name, so selecting a client can actually
 * pre-fill companyName/Address/Ico/Dic instead of leaving them blank.
 */
export async function getClientOptions() {
  return prisma.client.findMany({
    select: { id: true, name: true, street: true, city: true, postCode: true, state: true, ico: true, dic: true },
    orderBy: { name: "asc" },
  });
}
