import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canManageFinance, isAdmin } from "@/lib/authz";
import { getQuoteDetail, getCompanySettings } from "@/lib/queries/finance";
import { formatCurrency, formatCurrencyWithCzk, formatDate } from "@/lib/format";
import { toCzk } from "@/lib/fx";
import { projectHref, clientHref } from "@/lib/slug";
import { convertQuoteToInvoiceAction, deleteQuoteAction, updateQuoteStatusAction, duplicateQuoteAction } from "@/lib/actions/finance";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { QuoteStatusPill } from "@/components/StatusPill";
import { DownloadPdfButton } from "@/components/finance/DownloadPdfButton";
import { groupItemsByCategory, categoryTotal } from "@/lib/line-items";
import { getLocale, getDictionary } from "@/lib/i18n";
import { addressLines, clientAddressLines, DEFAULT_ACCENT } from "@/lib/pdf/shared";
import { DocumentPreviewScaler } from "@/components/finance/DocumentPreviewScaler";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import type { Locale } from "@/lib/dictionary";

export default async function QuoteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ previewLang?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const t = getDictionary(await getLocale());
  // The preview card's own language toggle — independent of the app's UI
  // language (t drives the rest of this page). Defaults to whatever the
  // app is currently set to.
  const { previewLang } = await searchParams;
  const appLocale = await getLocale();
  const activePreviewLang: Locale = previewLang === "cs" || previewLang === "en" ? previewLang : appLocale;
  const pq = getDictionary(activePreviewLang).finance.quotes;
  const [quote, company] = await Promise.all([getQuoteDetail(user, id), getCompanySettings()]);
  if (!quote) notFound();

  const supplierAddressLines = addressLines(company?.address ?? "");
  const client = quote.project.client;
  const customerAddressLines = client ? clientAddressLines(client) : addressLines(quote.project.companyAddress);
  const accent = company?.accentColor || DEFAULT_ACCENT;

  const canManage = canManageFinance(user);
  const base = quote.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const vat = quote.items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0);
  // Mobile's plain-summary card (not the pixel-matched PDF preview below,
  // which stays PDF-only currency) gets the CZK bracket on the grand total.
  const totalCzk = await toCzk(base + vat, quote.currency, quote.issuedAt);
  const expired = quote.status !== "ACCEPTED" && quote.status !== "DECLINED" && quote.validUntil < new Date();
  const alreadyInvoiced = quote.invoices.length > 0;
  const groups = groupItemsByCategory(quote.items);

  return (
    <div>
      <PageHeader>
        <div className="flex justify-between items-end flex-wrap gap-2 mt-2">
          <div>
            <div className="text-[24px] font-bold tracking-tight">{t.finance.quotes.quoteN(quote.number)}</div>
            <div className="placeholder-text text-[12px] mt-1">
              {t.finance.quotes.metaLine(quote.project.title, quote.project.companyName, formatDate(quote.issuedAt), formatDate(quote.validUntil))}
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
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-5 mt-5">
        <div className="min-w-0">
          {/* Phone: the scaled-to-fit A4 preview is an unreadable near-empty
              card at this width (mobile-review finding). Native line-item +
              totals summary instead; full PDF is a tap away in the header. */}
          <div className="md:hidden card p-4">
            <div className="heading-label !text-[12px] mb-2.5">{t.finance.quotes.quoteN(quote.number)}</div>
            {groups.map((g) => (
              <div key={g.category || "—"} className="mb-3 last:mb-0">
                {g.category && <div className="label mb-1">{g.category}</div>}
                {g.items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-3 py-1.5 border-b border-ink/8 last:border-b-0 text-[13px]">
                    <span className="min-w-0">
                      {item.description}
                      {!quote.hideItemPrices && (
                        <span className="placeholder-text">{` · ${item.quantity} × ${formatCurrency(item.unitPrice, quote.currency)} · ${item.vatRate}%`}</span>
                      )}
                    </span>
                    {!quote.hideItemPrices && (
                      <span className="shrink-0 tabular-nums">{formatCurrency(item.quantity * item.unitPrice, quote.currency)}</span>
                    )}
                  </div>
                ))}
                {quote.hideItemPrices && g.category && (
                  <div className="flex justify-end text-[12px] font-semibold mt-1 tabular-nums">
                    {formatCurrency(categoryTotal(g.items), quote.currency)}
                  </div>
                )}
              </div>
            ))}
            <div className="flex flex-col gap-1 mt-3 pt-3 border-t border-ink/12 text-[13px]">
              <div className="flex justify-between">
                <span className="placeholder-text">{t.finance.quotes.base}</span>
                <span className="tabular-nums">{formatCurrency(base, quote.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="placeholder-text">{t.finance.quotes.vat}</span>
                <span className="tabular-nums">{formatCurrency(vat, quote.currency)}</span>
              </div>
              <div className="flex justify-between font-bold text-[15px] mt-1">
                <span>{t.finance.quotes.total}</span>
                <span className="tabular-nums" style={{ color: accent }}>{formatCurrencyWithCzk(base + vat, quote.currency, totalCzk)}</span>
              </div>
            </div>
            <a href={`/api/quotes/${quote.id}/pdf`} target="_blank" rel="noreferrer" className="btno w-full text-center block mt-3">
              {t.finance.downloadPdf.downloadPdf}
            </a>
          </div>

          <div className="hidden md:block">
          <div className="flex justify-end mb-2">
            <SegmentedTabs
              options={[
                { value: "cs", label: "CZ", href: "?previewLang=cs" },
                { value: "en", label: "EN", href: "?previewLang=en" },
              ]}
              active={activePreviewLang}
            />
          </div>
          {/* Built at the mockup's literal 794px page width for exact fidelity, then scaled to fit the card via DocumentPreviewScaler — so it's a 1:1 reproduction the user sees whole, not a strip they scroll sideways through. */}
          <div className="card p-8 min-w-0">
          <DocumentPreviewScaler width={794}>
          <div className="w-[794px] h-[1123px] pt-[16px] flex flex-col gap-2.5">
            <div className="flex justify-between items-start">
              <div className="text-[154px] leading-[0.8] font-bold tracking-[-4px] lowercase pb-[14px]">
                {pq.quoteLabel}
              </div>
              <div className="flex flex-col items-end gap-[6px] pt-[8px]">
                {company?.logoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element -- authenticated route, not a static asset next/image can optimize
                  <img src={`/api/uploads/logo/${company.logoPath}`} alt="" className="w-[34px] h-[34px] object-contain" />
                ) : (
                  <div
                    className="w-[34px] h-[34px] rounded-[8px] flex items-center justify-center text-[14px] font-bold text-white"
                    style={{ backgroundColor: accent }}
                  >
                    {(company?.name ?? pq.companyFallback).charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="text-[12px] font-bold">{company?.name ?? pq.companyFallback}</div>
              </div>
            </div>

            {/* Extra top clearance vs. the invoice's 38px — "quote"/"nabídka" both carry a descender ("q") or a tall diacritic ("í") the tighter invoice wordmark ("invoice") never hits, so the same margin let this row clip into the wordmark. Wordmark itself is untouched; only this row and everything after it moved down. */}
            <div className="flex justify-between items-start mt-[60px] text-[19px] leading-[1.35]">
              <div>
                <div>
                  {pq.colIssued} {formatDate(quote.issuedAt)}
                </div>
                <div>
                  {pq.colValidTo} {formatDate(quote.validUntil)}
                </div>
              </div>
              <div className="text-[19px] font-bold">{quote.number}</div>
            </div>

            <div className="grid grid-cols-[29%_29%_38%] gap-[32px] mt-[40px] mb-[28px]">
              <div>
                <div className="label mb-[5px] !text-[8px] !tracking-[1px]">{pq.supplier}</div>
                <div className="font-bold text-[11px] mb-[3px]">{company?.name}</div>
                {supplierAddressLines.map((line) => (
                  <div key={line} className="placeholder-text text-[9.5px] leading-[1.5]">
                    {line}
                  </div>
                ))}
                <div className="placeholder-text text-[9.5px] leading-[1.5] mt-[3px]">{`IČO ${company?.ico} · DIČ ${company?.dic}`}</div>
              </div>
              <div>
                <div className="label mb-[5px] !text-[8px] !tracking-[1px]">{pq.customer}</div>
                <div className="font-bold text-[11px] mb-[3px]">{quote.project.companyName}</div>
                {customerAddressLines.map((line) => (
                  <div key={line} className="placeholder-text text-[9.5px] leading-[1.5]">
                    {line}
                  </div>
                ))}
                <div className="placeholder-text text-[9.5px] leading-[1.5] mt-[3px]">{`IČO ${quote.project.companyIco || "—"} · DIČ ${quote.project.companyDic || "—"}`}</div>
              </div>
              <div>
                <div className="label mb-[5px] !text-[8px] !tracking-[1px]">{pq.createdByHeading}</div>
                <div className="font-bold text-[13px] mb-[3px]">{quote.createdBy.name}</div>
                {quote.createdBy.email && (
                  <div className="placeholder-text text-[10px] leading-[1.6]">{quote.createdBy.email}</div>
                )}
                {quote.createdBy.phone && (
                  <div className="placeholder-text text-[10px] leading-[1.6]">{quote.createdBy.phone}</div>
                )}
              </div>
            </div>

            <div>
              {!quote.hideItemPrices && (
                <div className="grid grid-cols-[2fr_.5fr_.7fr_.5fr_.9fr] gap-2 border-b-2 border-ink pb-[6px] text-[8px] tracking-[0.6px]">
                  <span className="heading-label !text-[8px]">{pq.colItem}</span>
                  <span className="heading-label !text-[8px]">{pq.colQty}</span>
                  <span className="heading-label !text-[8px]">{pq.colUnit}</span>
                  <span className="heading-label !text-[8px]">{pq.colVat}</span>
                  <span className="heading-label !text-[8px] text-right">{pq.total}</span>
                </div>
              )}
              {groups.map((g) => (
                <div key={g.category || "—"}>
                  {g.category && <div className="label !text-[8px] !tracking-[1px] mt-[28px] mb-[4px]">{g.category}</div>}
                  {g.items.map((item) =>
                    quote.hideItemPrices ? (
                      <div key={item.id} className="py-[5px] text-[10.5px] border-b border-ink/8">
                        {item.description}
                      </div>
                    ) : (
                      <div
                        key={item.id}
                        className="grid grid-cols-[2fr_.5fr_.7fr_.5fr_.9fr] gap-2 py-[7px] text-[10.5px] border-b border-ink/8 items-center"
                      >
                        <span>{item.description}</span>
                        <span className="placeholder-text text-right">{item.quantity}</span>
                        <span className="placeholder-text text-right">{formatCurrency(item.unitPrice, quote.currency)}</span>
                        <span className="placeholder-text text-right">{item.vatRate}%</span>
                        <span className="text-right">{formatCurrency(item.quantity * item.unitPrice, quote.currency)}</span>
                      </div>
                    )
                  )}
                  {quote.hideItemPrices && g.category && (
                    <div className="flex justify-end text-[10px] font-bold mt-[3px] mb-[10px]">
                      {formatCurrency(categoryTotal(g.items), quote.currency)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end items-center gap-[36px] mt-[24px] text-[11px]">
              <div className="text-right">
                <span className="label !text-[8px] !tracking-[1px] block">{pq.base}</span>
                <span className="mt-[3px] block">{formatCurrency(base, quote.currency)}</span>
              </div>
              <div className="text-right">
                <span className="label !text-[8px] !tracking-[1px] block">{pq.vat}</span>
                <span className="mt-[3px] block">{formatCurrency(vat, quote.currency)}</span>
              </div>
              <div className="text-right">
                <span className="label !text-[8px] !tracking-[1px] block">{pq.total}</span>
                <span className="font-bold text-[22px] mt-[3px] block" style={{ color: accent }}>
                  {formatCurrency(base + vat, quote.currency)}
                </span>
              </div>
            </div>
            <div className="flex-1" />
            <div className="placeholder-text text-[9.5px] leading-[1.5] pt-[16px] border-t border-ink/10">
              {pq.renderedNote(formatDate(quote.validUntil))}
            </div>
          </div>
          </DocumentPreviewScaler>
          </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="card px-4 py-4">
            <div className="heading-label !text-[12px]">{t.finance.quotes.statusHeading}</div>
            <div className={`text-lg font-semibold mt-1 ${expired ? "text-warning" : ""}`}>
              {expired ? t.finance.quotes.expired : t.finance.quotes.valid}
            </div>
            <div className="placeholder-text text-[10px]">{t.finance.quotes.until(formatDate(quote.validUntil))}</div>
          </div>

          <div className="card px-4 py-4">
            <div className="heading-label !text-[12px] mb-1">{t.finance.quotes.linkedHeading}</div>
            <div className="py-1.5 text-[13px]">
              <Link href={projectHref(quote.project)} className="hover:text-accent">
                {t.finance.quotes.projectLink(quote.project.title)}
              </Link>
            </div>
            {client && (
              <div className="py-1.5 text-[13px]">
                <Link href={clientHref(client)} className="hover:text-accent">
                  {t.finance.quotes.clientLink(client.name)}
                </Link>
              </div>
            )}
            {quote.invoices.map((inv) => (
              <div key={inv.id} className="py-1.5 text-[13px]">
                <Link href={`/finance/invoices/${inv.id}`} className="hover:text-accent">
                  {t.finance.quotes.invoiceLink(inv.number)}
                </Link>
              </div>
            ))}
          </div>

          <div className="card px-4 py-4">
            <div className="heading-label !text-[12px] mb-1">{t.finance.quotes.createdByHeading}</div>
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
              <div className="heading-label !text-[12px] mb-1.5">{t.finance.quotes.deleteHeading}</div>
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
