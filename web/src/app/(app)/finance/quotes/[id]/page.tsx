import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canManageFinance, isAdmin } from "@/lib/authz";
import { getQuoteDetail, getCompanySettings } from "@/lib/queries/finance";
import { formatCurrency, formatCurrencyWithCzk, formatDateWithYear } from "@/lib/format";
import { toCzk } from "@/lib/fx";
import { projectHref, clientHref } from "@/lib/slug";
import { convertQuoteToInvoiceAction, deleteQuoteAction, updateQuoteStatusAction, duplicateQuoteAction } from "@/lib/actions/finance";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { QuoteStatusPill } from "@/components/StatusPill";
import { DownloadPdfButton } from "@/components/finance/DownloadPdfButton";
import { groupItemsByCategory, categoryTotal } from "@/lib/line-items";
import { getLocale, getDictionary } from "@/lib/i18n";
import { QuoteStatusMenu } from "@/components/finance/QuoteStatusMenu";
import { addressLines, clientAddressLines, DEFAULT_ACCENT, pdfDate, money, documentIds } from "@/lib/pdf/shared";
import { parsePdfTheme, PDF_METRICS } from "@/lib/pdf/theme";
import { pdfLabels } from "@/lib/pdf/i18n";
import { DocumentPreviewScaler } from "@/components/finance/DocumentPreviewScaler";
import { DocumentPreview, PreviewLabel, PreviewLine, PreviewPartyName, previewQuery } from "@/components/finance/DocumentPreview";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import type { Locale } from "@/lib/dictionary";


export default async function QuoteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ previewLang?: string; previewTheme?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const t = getDictionary(await getLocale());
  // The preview card's own language toggle — independent of the app's UI
  // language (t drives the rest of this page). Defaults to whatever the
  // app is currently set to.
  const { previewLang, previewTheme: previewThemeParam } = await searchParams;
  const appLocale = await getLocale();
  const activePreviewLang: Locale = previewLang === "cs" || previewLang === "en" ? previewLang : appLocale;
  // Light or dark PDF; the preview, the download menu and the phone link all follow it.
  const previewTheme = parsePdfTheme(previewThemeParam);
  const pl = pdfLabels(activePreviewLang);
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
  const supplierIds = documentIds(company?.ico ?? "", company?.dic ?? "");
  const customerIds = documentIds(quote.project.companyIco, quote.project.companyDic);

  return (
    <div>
      <PageHeader>
        <div className="flex justify-between items-end flex-wrap gap-2 mt-2">
          <div>
            <div className="text-[24px] font-bold tracking-tight">{t.finance.quotes.quoteN(quote.number)}</div>
            <div className="placeholder-text text-[12px] mt-1">
              {t.finance.quotes.metaLine(quote.project.title, quote.project.companyName, formatDateWithYear(quote.issuedAt), formatDateWithYear(quote.validUntil))}
            </div>
          </div>
          <div className="flex gap-1.5 items-center">
            {canManage ? (
              <QuoteStatusMenu quoteId={quote.id} status={quote.status} locale={appLocale} />
            ) : (
              <QuoteStatusPill status={quote.status} t={t.statusQuote} />
            )}
            <DownloadPdfButton pdfUrl={`/api/quotes/${quote.id}/pdf`} label={t.finance.downloadPdf.downloadPdf} theme={previewTheme} />
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
            <a href={`/api/quotes/${quote.id}/pdf?theme=${previewTheme}`} target="_blank" rel="noreferrer" className="btno w-full text-center block mt-3">
              {t.finance.downloadPdf.downloadPdf}
            </a>
          </div>

          <div className="hidden md:block">
          <div className="flex justify-end gap-2 mb-2">
            <SegmentedTabs
              options={[
                { value: "light", label: t.finance.previewTheme.light, href: previewQuery(activePreviewLang, "light") },
                { value: "dark", label: t.finance.previewTheme.dark, href: previewQuery(activePreviewLang, "dark") },
              ]}
              active={previewTheme}
            />
            <SegmentedTabs
              options={[
                { value: "cs", label: "CZ", href: previewQuery("cs", previewTheme) },
                { value: "en", label: "EN", href: previewQuery("en", previewTheme) },
              ]}
              active={activePreviewLang}
            />
          </div>
          {/* The PDF page at 96 dpi (794px wide), scaled to fit the card by DocumentPreviewScaler. */}
          {/* The page itself is the card: no frame around it. */}
          <div className="min-w-0 rounded-[22px] overflow-hidden">
          <DocumentPreviewScaler width={794} fill>
            <DocumentPreview
              theme={previewTheme}
              kind="quote"
              wordmark={pl.quote}
              accent={accent}
              logoUrl={company?.logoPath ? `/api/uploads/logo/${company.logoPath}` : null}
              companyName={company?.name ?? "Company"}
              dateLines={[`${pl.issued} ${pdfDate(quote.issuedAt, activePreviewLang)}`, `${pl.validUntil} ${pdfDate(quote.validUntil, activePreviewLang)}`]}
              number={quote.number}
              project={quote.project.title}
              parties={[
                <>
                  <PreviewLabel theme={previewTheme}>{pl.supplier}</PreviewLabel>
                  <PreviewPartyName>{company?.name}</PreviewPartyName>
                  {supplierAddressLines.map((line) => (
                    <PreviewLine key={line} theme={previewTheme}>
                      {line}
                    </PreviewLine>
                  ))}
                  {supplierIds && (
                    <PreviewLine theme={previewTheme} marginTop={PDF_METRICS.idsMarginTop}>
                      {supplierIds}
                    </PreviewLine>
                  )}
                  {company && !company.isVatPayer && <PreviewLine theme={previewTheme}>{pl.notVatPayer}</PreviewLine>}
                </>,
                <>
                  <PreviewLabel theme={previewTheme}>{pl.customer}</PreviewLabel>
                  <PreviewPartyName>{quote.project.companyName}</PreviewPartyName>
                  {customerAddressLines.map((line) => (
                    <PreviewLine key={line} theme={previewTheme}>
                      {line}
                    </PreviewLine>
                  ))}
                  {customerIds && (
                    <PreviewLine theme={previewTheme} marginTop={PDF_METRICS.idsMarginTop}>
                      {customerIds}
                    </PreviewLine>
                  )}
                </>,
                <>
                  <PreviewLabel theme={previewTheme}>{pl.createdBy}</PreviewLabel>
                  <PreviewPartyName size={PDF_METRICS.createdBy.nameSize}>{quote.createdBy.name}</PreviewPartyName>
                  {quote.createdBy.email && (
                    <PreviewLine theme={previewTheme} size={PDF_METRICS.createdBy.lineSize}>
                      {quote.createdBy.email}
                    </PreviewLine>
                  )}
                  {quote.createdBy.phone && (
                    <PreviewLine theme={previewTheme} size={PDF_METRICS.createdBy.lineSize}>
                      {quote.createdBy.phone}
                    </PreviewLine>
                  )}
                </>,
              ]}
              hideItemPrices={quote.hideItemPrices}
              items={quote.items}
              currency={quote.currency}
              columns={{ item: pl.item, qty: pl.qty, unit: pl.unit, vat: pl.vat, total: pl.total }}
              summary={[
                { label: pl.base, value: money(base, quote.currency) },
                { label: pl.vat, value: money(vat, quote.currency) },
                { label: pl.total, value: money(base + vat, quote.currency), accent: true },
              ]}
              footer={pl.quoteValidUntil(pdfDate(quote.validUntil, activePreviewLang))}
            />
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
            <div className="placeholder-text text-[10px]">{t.finance.quotes.until(formatDateWithYear(quote.validUntil))}</div>
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
              <div className="placeholder-text text-[11px]">{formatDateWithYear(quote.issuedAt)}</div>
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
