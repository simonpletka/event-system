import { prisma } from "@/lib/prisma";
import { toCzk } from "@/lib/fx";

/**
 * A project's "value" is never manually typed — it's derived from real
 * financial documents, and is always the pre-VAT base (`subtotal`, not
 * `total`) — VAT is a pass-through liability, not revenue, so it has no
 * place in a "how much is this project worth" figure. The invoice/quote
 * document itself still shows the full VAT-inclusive total as normal.
 *  - the latest quote's subtotal, if that quote is ACCEPTED;
 *  - else the sum of every invoice's subtotal issued for the project, if
 *    there are any — covers a quote that was declined but invoiced anyway,
 *    and a project invoiced with no quote in the picture at all;
 *  - else 0 (nothing confirmed, nothing invoiced yet — a DRAFT/SENT quote
 *    alone doesn't count as "the value").
 * Converted to CZK via the CNB rate on each document's own issue date when
 * it's in a foreign currency (see src/lib/fx.ts).
 */
export async function computeQuotedValue(projectId: string): Promise<number> {
  const latestQuote = await prisma.quote.findFirst({
    where: { projectId },
    orderBy: { issuedAt: "desc" },
    select: { subtotal: true, currency: true, issuedAt: true, status: true },
  });
  if (latestQuote?.status === "ACCEPTED") {
    return toCzk(latestQuote.subtotal, latestQuote.currency, latestQuote.issuedAt);
  }

  const invoices = await prisma.invoice.findMany({
    where: { projectId },
    select: { subtotal: true, currency: true, issuedAt: true },
  });
  if (invoices.length > 0) {
    const converted = await Promise.all(invoices.map((i) => toCzk(i.subtotal, i.currency, i.issuedAt)));
    return converted.reduce((sum, v) => sum + v, 0);
  }

  return 0;
}

/** Recomputes and stores a project's quotedValue — call after any quote/invoice create, edit, or delete. */
export async function syncQuotedValue(projectId: string): Promise<void> {
  const value = await computeQuotedValue(projectId);
  await prisma.project.update({ where: { id: projectId }, data: { quotedValue: value } });
}
