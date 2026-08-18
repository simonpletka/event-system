import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canManageFinance, isAdmin } from "@/lib/authz";
import { getInvoiceDetail, getCompanySettings } from "@/lib/queries/finance";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { recordPaymentAction, markInvoicePaidAction, revertInvoicePaidAction, deleteInvoiceAction } from "@/lib/actions/finance";
import { BackLink } from "@/components/BackLink";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { DownloadPdfButton } from "@/components/finance/DownloadPdfButton";
import { groupItemsByCategory, categoryTotal } from "@/lib/line-items";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [invoice, company] = await Promise.all([getInvoiceDetail(user, id), getCompanySettings()]);
  if (!invoice) notFound();

  const canManage = canManageFinance(user);
  const base = invoice.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const vat = invoice.items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0);
  const remaining = invoice.total - invoice.amountPaid;
  const overdue = invoice.status !== "PAID" && invoice.dueDate < new Date();
  const progress = invoice.total > 0 ? Math.min(100, Math.round((invoice.amountPaid / invoice.total) * 100)) : 0;
  const groups = groupItemsByCategory(invoice.items);
  // Rounded before comparing — base+vat is floating-point (vat sums
  // fractional per-item amounts) while invoice.total is a stored, already-
  // rounded Int, so an un-rounded diff is spuriously nonzero even with no
  // discount applied (e.g. 0.34) and would otherwise show a "-0 Kč" row.
  const discountAmount = Math.round(base + vat) - invoice.total;
  const realAmountPaid = invoice.payments.reduce((s, p) => s + p.amount, 0);
  // "Undo mark as paid" only has something to undo when the PAID status
  // isn't already fully backed by real recorded payments — otherwise it's a
  // silent no-op that never lets the invoice go back to "Mark as paid" (a
  // real bug found in testing: the button stayed visible forever with no
  // visible effect for an invoice paid via genuine Payment rows).
  const canUndoPaid = invoice.status === "PAID" && realAmountPaid < invoice.total;

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-6 -mt-5 px-6 pt-5 pb-4 backdrop-blur-2xl bg-gradient-to-b from-bg/80 to-bg/50 border-b border-ink/10">
        <BackLink href="/finance/invoices">Invoices</BackLink>
        <div className="flex justify-between items-end flex-wrap gap-2 mt-2">
          <div>
            <div className="text-[24px] font-bold tracking-tight">Invoice {invoice.number}</div>
            <div className="placeholder-text text-[12px] mt-1">
              {invoice.event.title} · {invoice.event.companyName} · issued {formatDate(invoice.issuedAt)}, due{" "}
              {formatDate(invoice.dueDate)}
            </div>
          </div>
          <div className="flex gap-1.5">
            <span className="btno opacity-40 cursor-not-allowed" title="Email sending isn't wired up yet">
              Send by mail
            </span>
            <DownloadPdfButton pdfUrl={`/api/invoices/${invoice.id}/pdf`} />
            {canManage && invoice.status !== "PAID" && (
              <form action={markInvoicePaidAction}>
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <button type="submit" className="btn">
                  Mark as paid
                </button>
              </form>
            )}
            {canManage && canUndoPaid && (
              <form action={revertInvoicePaidAction}>
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <button type="submit" className="btno">
                  Undo mark as paid
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-5 mt-5">
        <div className="card p-5 flex flex-col gap-2.5">
          <div className="flex justify-between items-start">
            <div className="text-sm font-semibold">{company?.name ?? "Company"}</div>
            <div className="text-right">
              <div className="label">Invoice</div>
              <div className="text-sm font-semibold">{invoice.number}</div>
            </div>
          </div>
          <div className="rule" />
          <div className="grid grid-cols-2 gap-3 text-[11px]">
            <div>
              <div className="label">Supplier</div>
              {company?.name}
              <div className="placeholder-text">
                {company?.address}
                <br />
                IČO {company?.ico} · DIČ {company?.dic}
                {company?.bankAccount ? (
                  <>
                    <br />
                    {company.bankAccount}
                  </>
                ) : null}
              </div>
            </div>
            <div>
              <div className="label">Customer</div>
              {invoice.event.companyName}
              <div className="placeholder-text">
                {invoice.event.companyAddress}
                <br />
                IČO {invoice.event.companyIco || "—"} · DIČ {invoice.event.companyDic || "—"}
              </div>
            </div>
          </div>

          {!invoice.hideItemPrices && (
            <div className="grid grid-cols-[2fr_.5fr_.7fr_.5fr_.9fr] gap-2 border-b-2 border-ink pb-1 text-[10px] mt-2">
              <span className="heading-label">Item</span>
              <span className="heading-label">Qty</span>
              <span className="heading-label">Unit</span>
              <span className="heading-label">VAT</span>
              <span className="heading-label text-right">Total</span>
            </div>
          )}
          {groups.map((g) => (
            <div key={g.category || "—"}>
              {g.category && <div className="label mt-2 mb-0.5">{g.category}</div>}
              {g.items.map((item) =>
                invoice.hideItemPrices ? (
                  <div key={item.id} className="py-1 text-[11px]">
                    {item.description}
                  </div>
                ) : (
                  <div key={item.id} className="grid grid-cols-[2fr_.5fr_.7fr_.5fr_.9fr] gap-2 py-1 text-[11px]">
                    <span>{item.description}</span>
                    <span className="placeholder-text">{item.quantity}</span>
                    <span className="placeholder-text">{formatCurrency(item.unitPrice, invoice.currency)}</span>
                    <span className="placeholder-text">{item.vatRate}%</span>
                    <span className="text-right">{formatCurrency(item.quantity * item.unitPrice, invoice.currency)}</span>
                  </div>
                )
              )}
              {invoice.hideItemPrices && g.category && (
                <div className="flex justify-end text-[11px] font-semibold py-0.5">
                  {formatCurrency(categoryTotal(g.items), invoice.currency)}
                </div>
              )}
            </div>
          ))}
          <div className="flex justify-end items-center gap-6 mt-2 text-[12px]">
            <div>
              <span className="label mr-2">Base</span>
              {formatCurrency(base, invoice.currency)}
            </div>
            <div>
              <span className="label mr-2">VAT</span>
              {formatCurrency(vat, invoice.currency)}
            </div>
            {discountAmount > 0 && (
              <div>
                <span className="label mr-2">Discount</span>-{formatCurrency(discountAmount, invoice.currency)}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="label mr-1">To pay</span>
              <span className="font-semibold text-base">{formatCurrency(invoice.total, invoice.currency)}</span>
              <span className="tag tag-neutral">{invoice.currency}</span>
            </div>
          </div>
          <div className="placeholder-text text-[9px] mt-auto pt-2">
            Rendered from the company invoice template · variable symbol {invoice.variableSymbol}
            {company?.bankAccount ? " · QR payment" : ""}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="card px-4 py-4">
            <div className="heading-label">Payment state</div>
            <div className="text-lg font-semibold mt-1">
              {invoice.status === "PAID" ? "Paid" : invoice.status === "PARTLY_PAID" ? "Partly paid" : overdue ? "Overdue" : "Issued"}
            </div>
            <div className="placeholder-text text-[10px]">
              {formatCurrency(invoice.amountPaid, invoice.currency)} of {formatCurrency(invoice.total, invoice.currency)}
              {invoice.paidAt ? ` received ${formatDate(invoice.paidAt)}` : ""}
            </div>
            <div className="h-1.5 rounded-full bg-ink/10 mt-2 overflow-hidden">
              <div className={`h-full rounded-full ${overdue ? "bg-warning" : "bg-accent"}`} style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-3">
              <div className="flex justify-between py-1.5 text-[13px] border-b border-ink/8">
                <div className="text-ink/70">Due</div>
                <div className="placeholder-text">{formatDate(invoice.dueDate)}</div>
              </div>
              <div className="flex justify-between py-1.5 text-[13px]">
                <div className="text-ink/70">Reminder</div>
                <div className="placeholder-text">not wired up yet</div>
              </div>
            </div>
          </div>

          {canManage && remaining > 0 && (
            <div className="card px-4 py-4">
              <form action={recordPaymentAction} className="flex flex-col gap-2">
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <span className="heading-label">Record payment</span>
                <input name="amount" type="number" min={1} max={remaining} defaultValue={remaining} className="input" />
                <input name="note" placeholder="Note (optional)" className="input" />
                <button type="submit" className="btno">
                  Record payment
                </button>
              </form>
            </div>
          )}

          <div className="card px-4 py-4">
            <div className="heading-label mb-1">Linked</div>
            <div className="py-1.5 text-[13px]">
              <Link href={`/events/${invoice.eventId}`} className="hover:text-accent">
                Event — {invoice.event.title} →
              </Link>
            </div>
            {invoice.quote && (
              <div className="py-1.5 text-[13px]">
                <Link href={`/finance/quotes/${invoice.quote.id}`} className="hover:text-accent">
                  Quote {invoice.quote.number} →
                </Link>
              </div>
            )}
            <div className="py-1.5 text-[13px]">
              <Link href={`/events/${invoice.eventId}/expenses`} className="hover:text-accent">
                Expenses on this event →
              </Link>
            </div>
          </div>

          <div className="card px-4 py-4">
            <div className="heading-label mb-1.5">History</div>
            {invoice.history.map((h) => (
              <div key={h.id} className="grid grid-cols-[52px_1fr] gap-2.5 py-1.5 text-[10px]">
                <div className="placeholder-text">{formatDateTime(h.createdAt)}</div>
                <div className="text-ink/80">{h.message}</div>
              </div>
            ))}
          </div>

          {isAdmin(user) && (
            <div className="card px-4 py-4">
              <div className="heading-label mb-1.5">Delete</div>
              <p className="text-[10px] placeholder-text mb-2.5">
                Removes this invoice, its line items, payment history and PDF permanently.
              </p>
              <ConfirmDeleteButton
                action={deleteInvoiceAction}
                fields={{ id: invoice.id }}
                label="Delete invoice"
                confirmMessage={`Delete invoice ${invoice.number}? This removes its payment history too and can't be undone.`}
                className="btno !border-warning text-warning w-full text-center"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
