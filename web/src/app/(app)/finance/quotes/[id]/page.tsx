import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canManageFinance, isAdmin } from "@/lib/authz";
import { getQuoteDetail, getCompanySettings } from "@/lib/queries/finance";
import { formatCurrency, formatDate } from "@/lib/format";
import { convertQuoteToInvoiceAction, deleteQuoteAction, updateQuoteStatusAction, duplicateQuoteAction } from "@/lib/actions/finance";
import { BackLink } from "@/components/BackLink";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { QuoteStatusPill } from "@/components/StatusPill";
import { DownloadPdfButton } from "@/components/finance/DownloadPdfButton";
import { groupItemsByCategory, categoryTotal } from "@/lib/line-items";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [quote, company] = await Promise.all([getQuoteDetail(user, id), getCompanySettings()]);
  if (!quote) notFound();

  const canManage = canManageFinance(user);
  const base = quote.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const vat = quote.items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0);
  const expired = quote.status !== "ACCEPTED" && quote.status !== "DECLINED" && quote.validUntil < new Date();
  const alreadyInvoiced = quote.invoices.length > 0;
  const groups = groupItemsByCategory(quote.items);

  return (
    <div>
      <BackLink href="/finance/quotes">Quotes</BackLink>
      <div className="flex justify-between items-end border-b-2 border-ink pb-2 flex-wrap gap-2">
        <div>
          <div className="text-xl font-semibold">Quote {quote.number}</div>
          <div className="placeholder-text text-[11px] mt-0.5">
            {quote.event.title} · {quote.event.companyName} · issued {formatDate(quote.issuedAt)}, valid until{" "}
            {formatDate(quote.validUntil)}
          </div>
        </div>
        <div className="flex gap-1.5 items-center">
          <QuoteStatusPill status={quote.status} />
          <DownloadPdfButton pdfUrl={`/api/quotes/${quote.id}/pdf`} />
          {canManage && quote.status === "DRAFT" && (
            <Link href={`/finance/quotes/${quote.id}/edit`} className="btno">
              Edit
            </Link>
          )}
          {canManage && quote.status === "SENT" && (
            <>
              <form action={updateQuoteStatusAction}>
                <input type="hidden" name="id" value={quote.id} />
                <input type="hidden" name="status" value="ACCEPTED" />
                <button type="submit" className="btn">
                  Mark accepted
                </button>
              </form>
              <form action={updateQuoteStatusAction}>
                <input type="hidden" name="id" value={quote.id} />
                <input type="hidden" name="status" value="DECLINED" />
                <button type="submit" className="btno">
                  Mark declined
                </button>
              </form>
            </>
          )}
          {canManage && quote.status === "ACCEPTED" && !alreadyInvoiced && (
            <form action={convertQuoteToInvoiceAction}>
              <input type="hidden" name="quoteId" value={quote.id} />
              <button type="submit" className="btn">
                Convert to invoice →
              </button>
            </form>
          )}
          {canManage && quote.status === "DECLINED" && (
            <form action={duplicateQuoteAction}>
              <input type="hidden" name="id" value={quote.id} />
              <button type="submit" className="btn">
                Create new (duplicate)
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_220px] gap-4 mt-3">
        {/* PDF preview — same content/layout the generated PDF renders, so this box IS the preview. */}
        <div className="border border-ink/25 p-4 flex flex-col gap-2.5">
          <div className="flex justify-between items-start">
            <div className="text-sm font-semibold">{company?.name ?? "Company"}</div>
            <div className="text-right">
              <div className="label">Quote</div>
              <div className="text-sm font-semibold">{quote.number}</div>
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
              </div>
            </div>
            <div>
              <div className="label">Customer</div>
              {quote.event.companyName}
              <div className="placeholder-text">
                {quote.event.companyAddress}
                <br />
                IČO {quote.event.companyIco || "—"} · DIČ {quote.event.companyDic || "—"}
              </div>
            </div>
          </div>

          {!quote.hideItemPrices && (
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
                quote.hideItemPrices ? (
                  <div key={item.id} className="py-1 text-[11px]">
                    {item.description}
                  </div>
                ) : (
                  <div key={item.id} className="grid grid-cols-[2fr_.5fr_.7fr_.5fr_.9fr] gap-2 py-1 text-[11px]">
                    <span>{item.description}</span>
                    <span className="placeholder-text">{item.quantity}</span>
                    <span className="placeholder-text">{formatCurrency(item.unitPrice, quote.currency)}</span>
                    <span className="placeholder-text">{item.vatRate}%</span>
                    <span className="text-right">{formatCurrency(item.quantity * item.unitPrice, quote.currency)}</span>
                  </div>
                )
              )}
              {quote.hideItemPrices && g.category && (
                <div className="flex justify-end text-[11px] font-semibold py-0.5">
                  {formatCurrency(categoryTotal(g.items), quote.currency)}
                </div>
              )}
            </div>
          ))}
          <div className="flex justify-end items-center gap-6 mt-2 text-[12px]">
            <div>
              <span className="label mr-2">Base</span>
              {formatCurrency(base, quote.currency)}
            </div>
            <div>
              <span className="label mr-2">VAT</span>
              {formatCurrency(vat, quote.currency)}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="label mr-1">Total</span>
              <span className="font-semibold text-base">{formatCurrency(base + vat, quote.currency)}</span>
              <span className="tag tag-neutral">{quote.currency}</span>
            </div>
          </div>
          <div className="placeholder-text text-[9px] mt-auto pt-2">
            Rendered from the company quote template · valid until {formatDate(quote.validUntil)}
          </div>
        </div>

        <div>
          <div className="label">Status</div>
          <div className={`border p-2 mt-1 ${expired ? "border-warning" : "border-ink/25"}`}>
            <div className="text-sm font-semibold">{expired ? "Expired" : "Valid"}</div>
            <div className="placeholder-text text-[9px]">Until {formatDate(quote.validUntil)}</div>
          </div>

          <div className="rule-thin my-2.5" />
          <div className="label">Linked</div>
          <div className="py-1.5 text-[13px]">
            <Link href={`/events/${quote.eventId}`} className="hover:text-accent">
              Event — {quote.event.title} →
            </Link>
          </div>
          {quote.invoices.map((inv) => (
            <div key={inv.id} className="py-1.5 text-[13px]">
              <Link href={`/finance/invoices/${inv.id}`} className="hover:text-accent">
                Invoice {inv.number} →
              </Link>
            </div>
          ))}

          <div className="rule-thin my-2.5" />
          <div className="label">Created by</div>
          <div className="py-1.5 text-[13px]">
            {quote.createdBy.name}
            <div className="placeholder-text text-[11px] mt-0.5">
              {quote.createdBy.email}
              {quote.createdBy.phone ? ` · ${quote.createdBy.phone}` : ""}
            </div>
            <div className="placeholder-text text-[11px]">{formatDate(quote.issuedAt)}</div>
          </div>

          {isAdmin(user) && (
            <>
              <div className="rule-thin my-2.5" />
              <div className="label mb-1.5">Delete</div>
              <p className="text-[10px] placeholder-text mb-2">
                Removes this quote and its line items permanently.
                {alreadyInvoiced ? " The invoice already created from it stays — just loses this link." : ""}
              </p>
              <ConfirmDeleteButton
                action={deleteQuoteAction}
                fields={{ id: quote.id }}
                label="Delete quote"
                confirmMessage={`Delete quote ${quote.number}? This can't be undone.`}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
