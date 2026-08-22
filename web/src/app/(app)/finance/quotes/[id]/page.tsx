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
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const t = getDictionary(await getLocale());
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
      <div className="sticky top-0 z-20 -mx-6 mt-0 md:-mt-5 px-6 pt-5 pb-4 backdrop-blur-2xl bg-gradient-to-b from-bg/80 to-bg/50 border-b border-ink/10">
        <BackLink href="/finance/quotes">{t.finance.quotes.backLink}</BackLink>
        <div className="flex justify-between items-end flex-wrap gap-2 mt-2">
          <div>
            <div className="text-[24px] font-bold tracking-tight">{t.finance.quotes.quoteN(quote.number)}</div>
            <div className="placeholder-text text-[12px] mt-1">
              {t.finance.quotes.metaLine(quote.event.title, quote.event.companyName, formatDate(quote.issuedAt), formatDate(quote.validUntil))}
            </div>
          </div>
          <div className="flex gap-1.5 items-center">
            <QuoteStatusPill status={quote.status} t={t.statusQuote} />
            <DownloadPdfButton pdfUrl={`/api/quotes/${quote.id}/pdf`} label={t.finance.downloadPdf.downloadPdf} />
            {canManage && quote.status === "DRAFT" && (
              <Link href={`/finance/quotes/${quote.id}/edit`} className="btno">
                {t.finance.quotes.edit}
              </Link>
            )}
            {canManage && quote.status === "SENT" && (
              <>
                <form action={updateQuoteStatusAction}>
                  <input type="hidden" name="id" value={quote.id} />
                  <input type="hidden" name="status" value="ACCEPTED" />
                  <button type="submit" className="btn">
                    {t.finance.quotes.markAccepted}
                  </button>
                </form>
                <form action={updateQuoteStatusAction}>
                  <input type="hidden" name="id" value={quote.id} />
                  <input type="hidden" name="status" value="DECLINED" />
                  <button type="submit" className="btno">
                    {t.finance.quotes.markDeclined}
                  </button>
                </form>
              </>
            )}
            {canManage && quote.status === "ACCEPTED" && !alreadyInvoiced && (
              <form action={convertQuoteToInvoiceAction}>
                <input type="hidden" name="quoteId" value={quote.id} />
                <button type="submit" className="btn">
                  {t.finance.quotes.convertToInvoice}
                </button>
              </form>
            )}
            {canManage && quote.status === "DECLINED" && (
              <form action={duplicateQuoteAction}>
                <input type="hidden" name="id" value={quote.id} />
                <button type="submit" className="btn">
                  {t.finance.quotes.createDuplicate}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-5 mt-5">
        {/* PDF preview — same content/layout the generated PDF renders, so this box IS the preview. */}
        <div className="card p-5 flex flex-col gap-2.5">
          <div className="flex justify-between items-start">
            <div className="text-sm font-semibold">{company?.name ?? t.finance.quotes.companyFallback}</div>
            <div className="text-right">
              <div className="label">{t.finance.quotes.quoteLabel}</div>
              <div className="text-sm font-semibold">{quote.number}</div>
            </div>
          </div>
          <div className="rule" />
          <div className="grid grid-cols-2 gap-3 text-[11px]">
            <div>
              <div className="label">{t.finance.quotes.supplier}</div>
              {company?.name}
              <div className="placeholder-text">
                {company?.address}
                <br />
                {`IČO ${company?.ico} · DIČ ${company?.dic}`}
              </div>
            </div>
            <div>
              <div className="label">{t.finance.quotes.customer}</div>
              {quote.event.companyName}
              <div className="placeholder-text">
                {quote.event.companyAddress}
                <br />
                {`IČO ${quote.event.companyIco || "—"} · DIČ ${quote.event.companyDic || "—"}`}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[440px]">
              {!quote.hideItemPrices && (
                <div className="grid grid-cols-[2fr_.5fr_.7fr_.5fr_.9fr] gap-2 border-b-2 border-ink pb-1 text-[10px] mt-2">
                  <span className="heading-label">{t.finance.quotes.colItem}</span>
                  <span className="heading-label">{t.finance.quotes.colQty}</span>
                  <span className="heading-label">{t.finance.quotes.colUnit}</span>
                  <span className="heading-label">{t.finance.quotes.colVat}</span>
                  <span className="heading-label text-right">{t.finance.quotes.total}</span>
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
            </div>
          </div>
          <div className="flex justify-end items-center gap-6 mt-2 text-[12px]">
            <div>
              <span className="label mr-2">{t.finance.quotes.base}</span>
              {formatCurrency(base, quote.currency)}
            </div>
            <div>
              <span className="label mr-2">{t.finance.quotes.vat}</span>
              {formatCurrency(vat, quote.currency)}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="label mr-1">{t.finance.quotes.total}</span>
              <span className="font-semibold text-base">{formatCurrency(base + vat, quote.currency)}</span>
              <span className="tag tag-neutral">{quote.currency}</span>
            </div>
          </div>
          <div className="placeholder-text text-[9px] mt-auto pt-2">{t.finance.quotes.renderedNote(formatDate(quote.validUntil))}</div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="card px-4 py-4">
            <div className="heading-label">{t.finance.quotes.statusHeading}</div>
            <div className={`text-lg font-semibold mt-1 ${expired ? "text-warning" : ""}`}>
              {expired ? t.finance.quotes.expired : t.finance.quotes.valid}
            </div>
            <div className="placeholder-text text-[10px]">{t.finance.quotes.until(formatDate(quote.validUntil))}</div>
          </div>

          <div className="card px-4 py-4">
            <div className="heading-label mb-1">{t.finance.quotes.linkedHeading}</div>
            <div className="py-1.5 text-[13px]">
              <Link href={`/events/${quote.eventId}`} className="hover:text-accent">
                {t.finance.quotes.eventLink(quote.event.title)}
              </Link>
            </div>
            {quote.invoices.map((inv) => (
              <div key={inv.id} className="py-1.5 text-[13px]">
                <Link href={`/finance/invoices/${inv.id}`} className="hover:text-accent">
                  {t.finance.quotes.invoiceLink(inv.number)}
                </Link>
              </div>
            ))}
          </div>

          <div className="card px-4 py-4">
            <div className="heading-label mb-1">{t.finance.quotes.createdByHeading}</div>
            <div className="py-1.5 text-[13px]">
              {quote.createdBy.name}
              <div className="placeholder-text text-[11px] mt-0.5">
                {quote.createdBy.email}
                {quote.createdBy.phone ? ` · ${quote.createdBy.phone}` : ""}
              </div>
              <div className="placeholder-text text-[11px]">{formatDate(quote.issuedAt)}</div>
            </div>
          </div>

          {isAdmin(user) && (
            <div className="card px-4 py-4">
              <div className="heading-label mb-1.5">{t.finance.quotes.deleteHeading}</div>
              <p className="text-[10px] placeholder-text mb-2.5">
                {t.finance.quotes.removesNote}
                {alreadyInvoiced ? ` ${t.finance.quotes.invoiceStaysNote}` : ""}
              </p>
              <ConfirmDeleteButton
                action={deleteQuoteAction}
                fields={{ id: quote.id }}
                label={t.finance.quotes.deleteQuoteBtn}
                pendingLabel={t.common.deleting}
                confirmMessage={t.finance.quotes.confirmDelete(quote.number)}
                className="btno !border-warning text-warning w-full text-center"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
