import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canManageFinance, isAdmin } from "@/lib/authz";
import { getInvoiceDetail, getCompanySettings } from "@/lib/queries/finance";
import { formatCurrency, formatCurrencyWithCzk, formatDate, formatDateTime, formatDateWithYear } from "@/lib/format";
import { toCzk } from "@/lib/fx";
import { projectHref, clientHref } from "@/lib/slug";
import {
  recordPaymentAction,
  markInvoicePaidAction,
  revertInvoicePaidAction,
  deleteInvoiceAction,
  sendInvoiceEmailAction,
  sendInvoiceReminderAction,
} from "@/lib/actions/finance";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { TrashIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { DownloadPdfButton } from "@/components/finance/DownloadPdfButton";
import { SendInvoiceEmailButton } from "@/components/finance/SendInvoiceEmailButton";
import { DocumentPreviewScaler } from "@/components/finance/DocumentPreviewScaler";
import { DocumentPreview, PreviewLabel, PreviewLine, PreviewPartyName, PreviewQr, previewQuery } from "@/components/finance/DocumentPreview";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { groupItemsByCategory, categoryTotal } from "@/lib/line-items";
import { getLocale, getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/dictionary";
import { addressLines, clientAddressLines, DEFAULT_ACCENT, pdfDate, money, documentIds } from "@/lib/pdf/shared";
import { parsePdfTheme, PDF_METRICS } from "@/lib/pdf/theme";
import { pdfLabels } from "@/lib/pdf/i18n";
import { variableSymbolFor } from "@/lib/document-number";
import { getInvoiceQrDataUrl, FALLBACK_SUPPLIER } from "@/lib/pdf/build-invoice-pdf";

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ previewLang?: string; previewTheme?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const t = getDictionary(await getLocale());
  const ti = t.finance.invoices;
  // The preview card's own language toggle — independent of the app's UI
  // language (t/ti drive the rest of this page). Defaults to whatever the
  // app is currently set to, same as the PDF's own EN/CZ chooser defaults
  // to English unless picked — here the natural default is "whatever
  // language you're already using the app in", not a fixed language.
  const { previewLang, previewTheme: previewThemeParam } = await searchParams;
  const appLocale = await getLocale();
  const activePreviewLang: Locale = previewLang === "cs" || previewLang === "en" ? previewLang : appLocale;
  // Light or dark PDF; the preview, the download menu and the phone link all follow it.
  const previewTheme = parsePdfTheme(previewThemeParam);
  const pl = pdfLabels(activePreviewLang);
  const [invoice, company] = await Promise.all([getInvoiceDetail(user, id), getCompanySettings()]);
  if (!invoice) notFound();

  const supplier = company ?? FALLBACK_SUPPLIER;
  const supplierAddressLines = addressLines(supplier.address);
  const client = invoice.project.client;
  const customerAddressLines = client ? clientAddressLines(client) : addressLines(invoice.project.companyAddress);
  const qrDataUrl = await getInvoiceQrDataUrl(invoice, supplier);
  const supplierIds = documentIds(supplier.ico, supplier.dic);
  const customerIds = documentIds(invoice.project.companyIco, invoice.project.companyDic);
  // Same fallback as the PDF builder when an invoice has no stored symbol.
  const variableSymbol = invoice.variableSymbol || variableSymbolFor(invoice.number);
  const accent = company?.accentColor || DEFAULT_ACCENT;

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
  // Mobile's plain-summary card and the payment-state widget (not the
  // pixel-matched PDF preview, which stays PDF-only currency) get the CZK
  // bracket on their totals.
  const [totalCzk, amountPaidCzk] = await Promise.all([
    toCzk(invoice.total, invoice.currency, invoice.issuedAt),
    toCzk(invoice.amountPaid, invoice.currency, invoice.issuedAt),
  ]);
  // "Undo mark as paid" only has something to undo when the PAID status
  // isn't already fully backed by real recorded payments — otherwise it's a
  // silent no-op that never lets the invoice go back to "Mark as paid" (a
  // real bug found in testing: the button stayed visible forever with no
  // visible effect for an invoice paid via genuine Payment rows).
  const canUndoPaid = invoice.status === "PAID" && realAmountPaid < invoice.total;

  return (
    <div>
      <PageHeader>
        <div className="flex justify-between items-end flex-wrap gap-2 mt-2">
          <div>
            <div className="text-[24px] font-bold tracking-tight">{ti.invoiceN(invoice.number)}</div>
            <div className="placeholder-text text-[12px] mt-1">
              {ti.metaLine(invoice.project.title, invoice.project.companyName, formatDateWithYear(invoice.issuedAt), formatDateWithYear(invoice.dueDate))}
            </div>
          </div>
          <div className="flex gap-1.5 items-center flex-wrap">
            {/* Delete is rare and irreversible: an icon at the far end from the
                primary action, split off by a divider, confirm dialog on click. */}
            {isAdmin(user) && (
              <>
                <ConfirmDeleteButton
                  action={deleteInvoiceAction}
                  fields={{ id: invoice.id }}
                  label={ti.deleteInvoiceBtn}
                  pendingLabel={t.common.deleting}
                  confirmMessage={ti.confirmDelete(invoice.number)}
                  title={ti.deleteInvoiceBtn}
                  className="grid place-items-center w-[33px] h-[33px] rounded-full border border-ink/20 text-ink/55 hover:text-warning hover:border-warning hover:bg-warning/10 transition-colors disabled:opacity-40"
                >
                  <TrashIcon size={14} />
                </ConfirmDeleteButton>
                <span aria-hidden className="w-px h-5 bg-ink/15 mx-1.5" />
              </>
            )}
            <DownloadPdfButton pdfUrl={`/api/invoices/${invoice.id}/pdf`} label={t.finance.downloadPdf.downloadPdf} theme={previewTheme} />
            {canManage && (
              <SendInvoiceEmailButton
                invoiceId={invoice.id}
                action={sendInvoiceEmailAction}
                label={ti.sendInvoice}
                pendingLabel={ti.sending}
                className="btno"
              />
            )}
            {canManage && invoice.status !== "PAID" && (
              <form action={markInvoicePaidAction}>
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <button type="submit" className="btn">
                  {ti.markAsPaid}
                </button>
              </form>
            )}
            {canManage && canUndoPaid && (
              <form action={revertInvoicePaidAction}>
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <button type="submit" className="btno">
                  {ti.undoMarkPaid}
                </button>
              </form>
            )}
          </div>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-5 mt-5">
        <div className="min-w-0">
          {/* Phone: the scaled-to-fit A4 preview is an unreadable near-empty
              card at this width (mobile-review finding). Show a native line-item
              + totals summary instead; the full PDF is one tap away in the
              header, and repeated here. */}
          <div className="md:hidden card p-4">
            <div className="heading-label !text-[12px] mb-2.5">{ti.invoiceN(invoice.number)}</div>
            {groups.map((g) => (
              <div key={g.category || "—"} className="mb-3 last:mb-0">
                {g.category && <div className="label mb-1">{g.category}</div>}
                {g.items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-3 py-1.5 border-b border-ink/8 last:border-b-0 text-[13px]">
                    <span className="min-w-0">
                      {item.description}
                      {!invoice.hideItemPrices && (
                        <span className="placeholder-text">{` · ${item.quantity} × ${formatCurrency(item.unitPrice, invoice.currency)} · ${item.vatRate}%`}</span>
                      )}
                    </span>
                    {!invoice.hideItemPrices && (
                      <span className="shrink-0 tabular-nums">{formatCurrency(item.quantity * item.unitPrice, invoice.currency)}</span>
                    )}
                  </div>
                ))}
                {invoice.hideItemPrices && g.category && (
                  <div className="flex justify-end text-[12px] font-semibold mt-1 tabular-nums">
                    {formatCurrency(categoryTotal(g.items), invoice.currency)}
                  </div>
                )}
              </div>
            ))}
            <div className="flex flex-col gap-1 mt-3 pt-3 border-t border-ink/12 text-[13px]">
              <div className="flex justify-between">
                <span className="placeholder-text">{ti.base}</span>
                <span className="tabular-nums">{formatCurrency(base, invoice.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="placeholder-text">{ti.vat}</span>
                <span className="tabular-nums">{formatCurrency(vat, invoice.currency)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between">
                  <span className="placeholder-text">{ti.discount}</span>
                  <span className="tabular-nums">-{formatCurrency(discountAmount, invoice.currency)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-[15px] mt-1">
                <span>{ti.toPay}</span>
                <span className="tabular-nums" style={{ color: accent }}>{formatCurrencyWithCzk(invoice.total, invoice.currency, totalCzk)}</span>
              </div>
            </div>
            <a href={`/api/invoices/${invoice.id}/pdf?theme=${previewTheme}`} target="_blank" rel="noreferrer" className="btno w-full text-center block mt-3">
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
          <div className="card p-8 min-w-0">
          <DocumentPreviewScaler width={794}>
            <DocumentPreview
              theme={previewTheme}
              kind="invoice"
              wordmark={pl.invoice}
              accent={accent}
              logoUrl={company?.logoPath ? `/api/uploads/logo/${company.logoPath}` : null}
              companyName={supplier.name}
              dateLines={[`${pl.issued} ${pdfDate(invoice.issuedAt, activePreviewLang)}`, `${pl.due} ${pdfDate(invoice.dueDate, activePreviewLang)}`]}
              number={invoice.number}
              parties={[
                <>
                  <PreviewLabel theme={previewTheme}>{pl.supplier}</PreviewLabel>
                  <PreviewPartyName>{supplier.name}</PreviewPartyName>
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
                  {!supplier.isVatPayer && <PreviewLine theme={previewTheme}>{pl.notVatPayer}</PreviewLine>}
                </>,
                <>
                  <PreviewLabel theme={previewTheme}>{pl.customer}</PreviewLabel>
                  <PreviewPartyName>{invoice.project.companyName}</PreviewPartyName>
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
                  <PreviewLabel theme={previewTheme}>{pl.paymentDetails}</PreviewLabel>
                  {supplier.accountNumber && (
                    <PreviewLine theme={previewTheme}>
                      {pl.accountNumber} {supplier.accountNumber}
                    </PreviewLine>
                  )}
                  {supplier.bankAccount && (
                    <PreviewLine theme={previewTheme} breakAll>
                      {supplier.bankAccount}
                    </PreviewLine>
                  )}
                  {supplier.swiftBic && (
                    <PreviewLine theme={previewTheme}>
                      {pl.swift} {supplier.swiftBic}
                    </PreviewLine>
                  )}
                  <PreviewLine theme={previewTheme}>
                    {pl.variableSymbol} {variableSymbol}
                  </PreviewLine>
                </>,
                <>
                  <PreviewLabel theme={previewTheme}>{pl.qrPlatba}</PreviewLabel>
                  <PreviewQr
                    theme={previewTheme}
                    qrDataUrl={qrDataUrl}
                    caption={qrDataUrl ? pl.scanToPay : invoice.currency !== "CZK" ? pl.qrCzkOnly : pl.noBankAccount}
                  />
                </>,
              ]}
              hideItemPrices={invoice.hideItemPrices}
              items={invoice.items}
              currency={invoice.currency}
              columns={{ item: pl.item, qty: pl.qty, unit: pl.unit, vat: pl.vat, total: pl.total }}
              summary={[
                { label: pl.base, value: money(base, invoice.currency) },
                { label: pl.vat, value: money(vat, invoice.currency) },
                ...(invoice.discountType !== "NONE" && discountAmount > 0
                  ? [{ label: pl.discount, value: `-${money(discountAmount, invoice.currency)}` }]
                  : []),
                { label: pl.toPay, value: money(invoice.total, invoice.currency), accent: true },
              ]}
              footer={pl.invoiceThanks}
            />
          </DocumentPreviewScaler>
          </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="card px-4 py-4">
            <div className="heading-label !text-[12px]">{ti.paymentStateHeading}</div>
            <div className="text-lg font-semibold mt-1">
              {invoice.status === "PAID" ? ti.paid : invoice.status === "PARTLY_PAID" ? ti.partlyPaid : overdue ? ti.overdue : ti.issued}
            </div>
            <div className="placeholder-text text-[10px]">
              {ti.amountOfTotal(
                formatCurrencyWithCzk(invoice.amountPaid, invoice.currency, amountPaidCzk),
                formatCurrencyWithCzk(invoice.total, invoice.currency, totalCzk)
              )}
              {invoice.paidAt ? ti.receivedOn(formatDate(invoice.paidAt)) : ""}
            </div>
            <div className="h-1.5 rounded-full bg-ink/10 mt-2 overflow-hidden">
              <div className={`h-full rounded-full ${overdue ? "bg-warning" : "bg-accent"}`} style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-3">
              <div className="flex justify-between py-1.5 text-[13px] border-b border-ink/8">
                <div className="text-ink/70">{ti.dueLabel}</div>
                <div className="placeholder-text">{formatDateWithYear(invoice.dueDate)}</div>
              </div>
              <div className="flex justify-between py-1.5 text-[13px] border-b border-ink/8">
                <div className="text-ink/70">{ti.sentLabel}</div>
                <div className="placeholder-text">{invoice.sentAt ? ti.sentOn(formatDate(invoice.sentAt)) : ti.notSentYet}</div>
              </div>
              <div className="flex justify-between py-1.5 text-[13px]">
                <div className="text-ink/70">{ti.reminderLabel}</div>
                <div className="placeholder-text">{invoice.lastReminderAt ? ti.reminderSentOn(formatDate(invoice.lastReminderAt)) : ti.noReminderSent}</div>
              </div>
            </div>
            {canManage && overdue && (
              <div className="mt-2">
                <SendInvoiceEmailButton
                  invoiceId={invoice.id}
                  action={sendInvoiceReminderAction}
                  label={ti.sendReminder}
                  pendingLabel={ti.sending}
                  className="btno w-full text-center"
                />
              </div>
            )}
          </div>

          {canManage && remaining > 0 && (
            <div className="card px-4 py-4">
              <form action={recordPaymentAction} className="flex flex-col gap-2">
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <span className="heading-label !text-[12px]">{ti.recordPaymentHeading}</span>
                <input name="amount" type="number" min={1} max={remaining} defaultValue={remaining} className="input" />
                <input name="note" placeholder={ti.notePlaceholder} className="input" />
                <button type="submit" className="btno">
                  {ti.recordPaymentBtn}
                </button>
              </form>
            </div>
          )}

          <div className="card px-4 py-4">
            <div className="heading-label !text-[12px] mb-1">{ti.linkedHeading}</div>
            <div className="py-1.5 text-[13px]">
              <Link href={projectHref(invoice.project)} className="hover:text-accent">
                {ti.projectLink(invoice.project.title)}
              </Link>
            </div>
            {client && (
              <div className="py-1.5 text-[13px]">
                <Link href={clientHref(client)} className="hover:text-accent">
                  {ti.clientLink(client.name)}
                </Link>
              </div>
            )}
            {invoice.quote && (
              <div className="py-1.5 text-[13px]">
                <Link href={`/finance/quotes/${invoice.quote.id}`} className="hover:text-accent">
                  {ti.quoteLink(invoice.quote.number)}
                </Link>
              </div>
            )}
            <div className="py-1.5 text-[13px]">
              <Link href={projectHref(invoice.project, "/expenses")} className="hover:text-accent">
                {ti.expensesLink}
              </Link>
            </div>
          </div>

          <div className="card px-4 py-4">
            <div className="heading-label !text-[12px] mb-1.5">{ti.historyHeading}</div>
            {invoice.history.map((h) => (
              <div key={h.id} className="grid grid-cols-[52px_1fr] gap-2.5 py-1.5 text-[10px]">
                <div className="placeholder-text">{formatDateTime(h.createdAt)}</div>
                <div className="text-ink/80">{h.message}</div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
