import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canManageFinance, isAdmin } from "@/lib/authz";
import { getInvoiceDetail, getCompanySettings } from "@/lib/queries/finance";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { projectHref, clientHref } from "@/lib/slug";
import {
  recordPaymentAction,
  markInvoicePaidAction,
  revertInvoicePaidAction,
  deleteInvoiceAction,
  sendInvoiceEmailAction,
  sendInvoiceReminderAction,
} from "@/lib/actions/finance";
import { BackLink } from "@/components/BackLink";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { DownloadPdfButton } from "@/components/finance/DownloadPdfButton";
import { SendInvoiceEmailButton } from "@/components/finance/SendInvoiceEmailButton";
import { DocumentPreviewScaler } from "@/components/finance/DocumentPreviewScaler";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { groupItemsByCategory, categoryTotal } from "@/lib/line-items";
import { getLocale, getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/dictionary";
import { addressLines, clientAddressLines, DEFAULT_ACCENT } from "@/lib/pdf/shared";
import { getInvoiceQrDataUrl, FALLBACK_SUPPLIER } from "@/lib/pdf/build-invoice-pdf";

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ previewLang?: string }>;
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
  const { previewLang } = await searchParams;
  const appLocale = await getLocale();
  const activePreviewLang: Locale = previewLang === "cs" || previewLang === "en" ? previewLang : appLocale;
  const pt = getDictionary(activePreviewLang).finance.invoices;
  const [invoice, company] = await Promise.all([getInvoiceDetail(user, id), getCompanySettings()]);
  if (!invoice) notFound();

  const supplier = company ?? FALLBACK_SUPPLIER;
  const supplierAddressLines = addressLines(supplier.address);
  const client = invoice.project.client;
  const customerAddressLines = client ? clientAddressLines(client) : addressLines(invoice.project.companyAddress);
  const qrDataUrl = await getInvoiceQrDataUrl(invoice, supplier);
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
  // "Undo mark as paid" only has something to undo when the PAID status
  // isn't already fully backed by real recorded payments — otherwise it's a
  // silent no-op that never lets the invoice go back to "Mark as paid" (a
  // real bug found in testing: the button stayed visible forever with no
  // visible effect for an invoice paid via genuine Payment rows).
  const canUndoPaid = invoice.status === "PAID" && realAmountPaid < invoice.total;

  return (
    <div>
      <PageHeader>
        <BackLink href="/finance/invoices">{ti.backLink}</BackLink>
        <div className="flex justify-between items-end flex-wrap gap-2 mt-2">
          <div>
            <div className="text-[24px] font-bold tracking-tight">{ti.invoiceN(invoice.number)}</div>
            <div className="placeholder-text text-[12px] mt-1">
              {ti.metaLine(invoice.project.title, invoice.project.companyName, formatDate(invoice.issuedAt), formatDate(invoice.dueDate))}
            </div>
          </div>
          <div className="flex gap-1.5 items-start">
            {canManage && (
              <SendInvoiceEmailButton
                invoiceId={invoice.id}
                action={sendInvoiceEmailAction}
                label={ti.sendInvoice}
                pendingLabel={ti.sending}
                className="btno"
              />
            )}
            <DownloadPdfButton pdfUrl={`/api/invoices/${invoice.id}/pdf`} label={t.finance.downloadPdf.downloadPdf} />
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
                <span className="tabular-nums" style={{ color: accent }}>{formatCurrency(invoice.total, invoice.currency)}</span>
              </div>
            </div>
            <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer" className="btno w-full text-center block mt-3">
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
              <div className="text-[154px] leading-[0.8] font-bold tracking-[-4px] lowercase pb-[14px]">{pt.invoiceLabel}</div>
              <div className="flex flex-col items-end gap-[6px] pt-[8px]">
                {company?.logoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element -- authenticated route, not a static asset next/image can optimize
                  <img src={`/api/uploads/logo/${company.logoPath}`} alt="" className="w-[34px] h-[34px] object-contain" />
                ) : (
                  <div
                    className="w-[34px] h-[34px] rounded-[8px] flex items-center justify-center text-[14px] font-bold text-white"
                    style={{ backgroundColor: accent }}
                  >
                    {(company?.name ?? pt.companyFallback).charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="text-[12px] font-bold">{company?.name ?? pt.companyFallback}</div>
              </div>
            </div>

            <div className="flex justify-between items-start mt-[38px] text-[19px] leading-[1.35]">
              <div>
                <div>
                  {pt.issued} {formatDate(invoice.issuedAt)}
                </div>
                <div>
                  {pt.dueLabel} {formatDate(invoice.dueDate)}
                </div>
              </div>
              <div className="text-[19px] font-bold">{invoice.number}</div>
            </div>

            <div className="grid grid-cols-[24%_24%_32%_14%] gap-[24px] mt-[40px] mb-[28px]">
              <div>
                <div className="label mb-[5px] !text-[8px] !tracking-[1px]">{pt.supplier}</div>
                <div className="font-bold text-[11px] mb-[3px]">{company?.name}</div>
                {supplierAddressLines.map((line) => (
                  <div key={line} className="placeholder-text text-[9.5px] leading-[1.5]">
                    {line}
                  </div>
                ))}
                <div className="placeholder-text text-[9.5px] leading-[1.5] mt-[3px]">{`IČO ${company?.ico} · DIČ ${company?.dic}`}</div>
              </div>
              <div>
                <div className="label mb-[5px] !text-[8px] !tracking-[1px]">{pt.customer}</div>
                <div className="font-bold text-[11px] mb-[3px]">{invoice.project.companyName}</div>
                {customerAddressLines.map((line) => (
                  <div key={line} className="placeholder-text text-[9.5px] leading-[1.5]">
                    {line}
                  </div>
                ))}
                <div className="placeholder-text text-[9.5px] leading-[1.5] mt-[3px]">{`IČO ${invoice.project.companyIco || "—"} · DIČ ${invoice.project.companyDic || "—"}`}</div>
              </div>
              <div className="break-words">
                <div className="label mb-[5px] !text-[8px] !tracking-[1px]">{pt.paymentDetails}</div>
                {supplier.accountNumber && (
                  <div className="placeholder-text text-[9.5px] leading-[1.5]">
                    {pt.accountNumber} {supplier.accountNumber}
                  </div>
                )}
                {supplier.bankAccount && (
                  <div className="placeholder-text text-[9.5px] leading-[1.5] break-all">{supplier.bankAccount}</div>
                )}
                {supplier.swiftBic && (
                  <div className="placeholder-text text-[9.5px] leading-[1.5]">
                    {pt.swift} {supplier.swiftBic}
                  </div>
                )}
                <div className="placeholder-text text-[9.5px] leading-[1.5]">
                  {pt.variableSymbolLabel} {invoice.variableSymbol}
                </div>
              </div>
              <div>
                <div className="label mb-[5px] !text-[8px] !tracking-[1px]">{pt.qrPlatba}</div>
                {qrDataUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL, not a static asset */}
                    <img src={qrDataUrl} alt="" className="w-[64px] h-[64px] rounded-[8px] bg-[#f3f2f2] p-[6px]" />
                    <div className="placeholder-text text-[8px] leading-[1.4] mt-[5px]">{pt.scanToPay}</div>
                  </>
                ) : (
                  <div className="placeholder-text text-[8px] leading-[1.4]">
                    {invoice.currency !== "CZK" ? "—" : pt.scanToPay}
                  </div>
                )}
              </div>
            </div>

            <div>
              {!invoice.hideItemPrices && (
                <div className="grid grid-cols-[2fr_.5fr_.7fr_.5fr_.9fr] gap-2 border-b-2 border-ink pb-[6px] text-[8px] tracking-[0.6px]">
                  <span className="heading-label !text-[8px]">{pt.colItem}</span>
                  <span className="heading-label !text-[8px]">{pt.colQty}</span>
                  <span className="heading-label !text-[8px]">{pt.colUnit}</span>
                  <span className="heading-label !text-[8px]">{pt.colVat}</span>
                  <span className="heading-label !text-[8px] text-right">{pt.total}</span>
                </div>
              )}
              {groups.map((g) => (
                <div key={g.category || "—"}>
                  {g.category && <div className="label !text-[8px] !tracking-[1px] mt-[28px] mb-[4px]">{g.category}</div>}
                  {g.items.map((item) =>
                    invoice.hideItemPrices ? (
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
                        <span className="placeholder-text text-right">{formatCurrency(item.unitPrice, invoice.currency)}</span>
                        <span className="placeholder-text text-right">{item.vatRate}%</span>
                        <span className="text-right">{formatCurrency(item.quantity * item.unitPrice, invoice.currency)}</span>
                      </div>
                    )
                  )}
                  {invoice.hideItemPrices && g.category && (
                    <div className="flex justify-end text-[10px] font-bold mt-[3px] mb-[10px]">
                      {formatCurrency(categoryTotal(g.items), invoice.currency)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end items-center gap-[36px] mt-[24px] text-[11px]">
              <div className="text-right">
                <span className="label !text-[8px] !tracking-[1px] block">{pt.base}</span>
                <span className="mt-[3px] block">{formatCurrency(base, invoice.currency)}</span>
              </div>
              <div className="text-right">
                <span className="label !text-[8px] !tracking-[1px] block">{pt.vat}</span>
                <span className="mt-[3px] block">{formatCurrency(vat, invoice.currency)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="text-right">
                  <span className="label !text-[8px] !tracking-[1px] block">{pt.discount}</span>
                  <span className="mt-[3px] block">-{formatCurrency(discountAmount, invoice.currency)}</span>
                </div>
              )}
              <div className="text-right">
                <span className="label !text-[8px] !tracking-[1px] block">{pt.toPay}</span>
                <span className="font-bold text-[22px] mt-[3px] block" style={{ color: accent }}>
                  {formatCurrency(invoice.total, invoice.currency)}
                </span>
              </div>
            </div>
            <div className="flex-1" />
            <div className="placeholder-text text-[9.5px] leading-[1.5] pt-[16px] border-t border-ink/10">
              {pt.invoiceThanks}
            </div>
          </div>
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
              {ti.amountOfTotal(formatCurrency(invoice.amountPaid, invoice.currency), formatCurrency(invoice.total, invoice.currency))}
              {invoice.paidAt ? ti.receivedOn(formatDate(invoice.paidAt)) : ""}
            </div>
            <div className="h-1.5 rounded-full bg-ink/10 mt-2 overflow-hidden">
              <div className={`h-full rounded-full ${overdue ? "bg-warning" : "bg-accent"}`} style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-3">
              <div className="flex justify-between py-1.5 text-[13px] border-b border-ink/8">
                <div className="text-ink/70">{ti.dueLabel}</div>
                <div className="placeholder-text">{formatDate(invoice.dueDate)}</div>
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

          {isAdmin(user) && (
            <div className="card px-4 py-4">
              <div className="heading-label !text-[12px] mb-1.5">{ti.deleteHeading}</div>
              <p className="text-[10px] placeholder-text mb-2.5">{ti.removesNote}</p>
              <ConfirmDeleteButton
                action={deleteInvoiceAction}
                fields={{ id: invoice.id }}
                label={ti.deleteInvoiceBtn}
                pendingLabel={t.common.deleting}
                confirmMessage={ti.confirmDelete(invoice.number)}
                className="btno !border-warning text-warning w-full text-center"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
