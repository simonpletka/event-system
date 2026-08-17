import Link from "next/link";
import { requireUser, canManageFinance, eventWhereForUser, quoteWhereForUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { convertQuoteToInvoiceAction } from "@/lib/actions/finance";
import { InvoiceForm } from "@/components/finance/InvoiceForm";

export default async function NewInvoicePage() {
  const user = await requireUser();

  if (!canManageFinance(user)) {
    return (
      <div>
        <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">New invoice</h1>
        <p className="text-sm placeholder-text">You don&apos;t have permission to create invoices.</p>
      </div>
    );
  }

  const [events, company, eligibleQuotes] = await Promise.all([
    prisma.event.findMany({
      where: eventWhereForUser(user),
      select: { id: true, title: true, companyName: true },
      orderBy: { title: "asc" },
    }),
    prisma.companySettings.findUnique({ where: { id: "singleton" } }),
    prisma.quote.findMany({
      where: { ...quoteWhereForUser(user), status: "ACCEPTED", invoices: { none: {} } },
      include: { event: true },
      orderBy: { issuedAt: "desc" },
    }),
  ]);

  const dueDays = company?.defaultDueDays ?? 14;
  const defaultDueDate = new Date(new Date().getTime() + dueDays * 86400000).toISOString().slice(0, 10);

  return (
    <div>
      <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">New invoice</h1>

      {eligibleQuotes.length > 0 && (
        <div className="border border-ink/25 p-3 mb-5 max-w-2xl">
          <div className="label mb-1.5">From an accepted quote</div>
          <p className="text-[10px] placeholder-text mb-2">
            Carries the quote&apos;s line items and currency straight over — quicker than filling in a blank invoice below.
          </p>
          {eligibleQuotes.map((q) => (
            <div key={q.id} className="flex justify-between items-center py-1.5 border-b border-ink/10 text-[13px] last:border-b-0">
              <div>
                <Link href={`/finance/quotes/${q.id}`} className="hover:text-accent">
                  {q.number}
                </Link>{" "}
                <span className="placeholder-text">
                  — {q.event.title} · {formatCurrency(q.total, q.currency)} · accepted {formatDate(q.issuedAt)}
                </span>
              </div>
              <form action={convertQuoteToInvoiceAction}>
                <input type="hidden" name="quoteId" value={q.id} />
                <button type="submit" className="btno text-[9px]">
                  Convert to invoice →
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      <div className="label mb-1.5 max-w-2xl">Or start from scratch</div>
      <InvoiceForm events={events} defaultDueDate={defaultDueDate} />
    </div>
  );
}
