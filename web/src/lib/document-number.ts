import { prisma } from "@/lib/prisma";

/**
 * Projects, quotes and invoices all share one "YY-XXX" identity scheme (e.g.
 * "26-001"): YY is the current year's last two digits, XXX is a 3-digit
 * sequence starting at 001. A project's number is assigned once, at creation,
 * by scanning existing numbers for the year and taking the lowest unused
 * XXX — not just count()+1 — so a permanently-deleted project's number
 * becomes reusable instead of leaving a permanent gap. Not safe under heavy
 * concurrent writes (no locking), same accepted tradeoff as the old
 * per-year quote/invoice counters this replaces.
 *
 * Quotes and invoices don't get their own independent sequence — each
 * reuses its parent project's base number, and only appends "_v2", "_v3", …
 * once there's more than one of that document type for the same project (the
 * first one has no suffix). A quote and an invoice for the same project can
 * therefore legitimately show the same number string — they're always
 * distinguishable by which section of the app they're in.
 */
export async function nextProjectNumber(year = new Date().getFullYear()) {
  const yy = String(year % 100).padStart(2, "0");
  const existing = await prisma.project.findMany({
    where: { number: { startsWith: `${yy}-` } },
    select: { number: true },
  });
  const used = new Set(
    existing.map((e) => Number(e.number.slice(3, 6))).filter((n) => Number.isInteger(n) && n > 0)
  );
  let n = 1;
  while (used.has(n)) n++;
  return `${yy}-${String(n).padStart(3, "0")}`;
}

async function nextVersionedNumber(baseNumber: string, existingCount: number) {
  return existingCount === 0 ? baseNumber : `${baseNumber}_v${existingCount + 1}`;
}

export async function nextQuoteNumber(projectId: string, projectNumber: string) {
  const count = await prisma.quote.count({ where: { projectId } });
  return nextVersionedNumber(projectNumber, count);
}

export async function nextInvoiceNumber(projectId: string, projectNumber: string) {
  const count = await prisma.invoice.count({ where: { projectId } });
  return nextVersionedNumber(projectNumber, count);
}

export function variableSymbolFor(invoiceNumber: string) {
  return invoiceNumber.replace(/\D/g, "");
}
