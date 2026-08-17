import { prisma } from "@/lib/prisma";

/** Per-year sequences matching the wireframes: quotes "YYYY-Q##", invoices "YYYY-####". */
export async function nextQuoteNumber(year = new Date().getFullYear()) {
  const count = await prisma.quote.count({
    where: { issuedAt: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) } },
  });
  return `${year}-Q${count + 1}`;
}

export async function nextInvoiceNumber(year = new Date().getFullYear()) {
  const count = await prisma.invoice.count({
    where: { issuedAt: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) } },
  });
  return `${year}-${String(count + 1).padStart(4, "0")}`;
}

export function variableSymbolFor(invoiceNumber: string) {
  return invoiceNumber.replace(/\D/g, "");
}
