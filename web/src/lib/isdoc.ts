import { randomUUID } from "crypto";
import { isoDate } from "@/lib/calendar";
import { discountFactor, vatBucketsForInvoice } from "@/lib/vat";

/**
 * ISDOC 6.0.2 ("Národní standard pro elektronickou fakturaci") — the Czech/
 * Slovak structured XML e-invoice format accounting software (Pohoda, Money
 * S3, ABRA, iDoklad, ...) can import directly instead of someone re-typing
 * the invoice by hand. Built against the real published schema
 * (isdoc.cz/6.0.2/xsd/isdoc-invoice-6.0.2.xsd), not from memory — every
 * element name/order/cardinality below was read straight out of that file.
 *
 * Deliberately narrow: only DocumentType 1 ("Faktura - daňový doklad" /
 * regular tax invoice), only bank-transfer PaymentMeansCode 42, no order/
 * delivery/contract references, no digital signature. Every field the
 * schema marks minOccurs="0" and that this app has no real value for is
 * simply omitted; every field the schema requires but this app has no
 * concept of (the many "AlreadyClaimed*"/"Difference*" advance-invoice
 * reconciliation fields, present because ISDOC's LegalMonetaryTotal and
 * TaxSubTotal double as deposit-invoice bookkeeping) is written as 0 —
 * this app doesn't do deposit/advance invoicing, so there's nothing to
 * reconcile and 0 is the schema-correct value, not a placeholder.
 */

const NS = "http://isdoc.cz/namespace/2013";

export type IsdocParty = {
  name: string;
  ico: string;
  dic: string;
  street: string;
  buildingNumber: string;
  city: string;
  postalZone: string;
};

export type IsdocLineItem = {
  description: string;
  quantity: number;
  unitPrice: number; // pre-VAT, pre-discount
  vatRate: number; // percent, e.g. 21
};

export type IsdocInvoiceInput = {
  number: string;
  issuedAt: Date;
  dueDate: Date;
  currency: string; // ISO 4217, e.g. "CZK"
  supplier: IsdocParty;
  customer: IsdocParty;
  items: IsdocLineItem[];
  /** Final, post-discount amount actually owed — must equal the sum of discounted line totals (rounding absorbed via PayableRoundingAmount). */
  total: number;
  variableSymbol: string;
  bankAccountNumber: string; // local format, e.g. "123456789/0300"
  iban: string;
  bic: string;
  supplierIsVatPayer: boolean;
};

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function el(name: string, content: string | number): string {
  return `<${name}>${typeof content === "number" ? content : xmlEscape(content)}</${name}>`;
}

function party(tagName: string, p: IsdocParty): string {
  const taxScheme = p.dic
    ? `<PartyTaxScheme>${el("CompanyID", p.dic)}${el("TaxScheme", "VAT")}</PartyTaxScheme>`
    : "";
  return `<${tagName}><Party>` +
    `<PartyIdentification>${el("ID", p.ico)}</PartyIdentification>` +
    `<PartyName>${el("Name", p.name)}</PartyName>` +
    `<PostalAddress>${el("StreetName", p.street)}${el("BuildingNumber", p.buildingNumber)}${el("CityName", p.city)}${el("PostalZone", p.postalZone)}<Country>${el("IdentificationCode", "CZ")}${el("Name", "Česká republika")}</Country></PostalAddress>` +
    taxScheme +
    `</Party></${tagName}>`;
}

/** Splits a local Czech account number like "19-123456789/0300" into (accountId, bankCode). */
function splitAccountNumber(accountNumber: string): { id: string; bankCode: string } {
  const slash = accountNumber.lastIndexOf("/");
  if (slash === -1) return { id: accountNumber, bankCode: "" };
  return { id: accountNumber.slice(0, slash), bankCode: accountNumber.slice(slash + 1) };
}

export function buildIsdocXml(input: IsdocInvoiceInput): string {
  // Proportional-scaling identity the app's own applyDiscount() relies on (see
  // actions/finance.ts) — shared with the finance report via lib/vat.ts so the
  // per-rate split can't drift between the two.
  const factor = discountFactor(input.items, input.total);
  const vatBuckets = vatBucketsForInvoice(input.items, input.total);

  const lines = input.items.map((item, idx) => {
    const lineBase = item.quantity * item.unitPrice * factor;
    const lineVat = lineBase * (item.vatRate / 100);
    const lineBaseR = Math.round(lineBase);
    const lineVatR = Math.round(lineVat);
    return (
      `<InvoiceLine>` +
      el("ID", String(idx + 1)) +
      `<InvoicedQuantity>${item.quantity}</InvoicedQuantity>` +
      el("LineExtensionAmount", lineBaseR) +
      el("LineExtensionAmountTaxInclusive", lineBaseR + lineVatR) +
      el("LineExtensionTaxAmount", lineVatR) +
      el("UnitPrice", Math.round(item.unitPrice * factor)) +
      el("UnitPriceTaxInclusive", Math.round(item.unitPrice * factor * (1 + item.vatRate / 100))) +
      `<ClassifiedTaxCategory>${el("Percent", item.vatRate)}<VATCalculationMethod>0</VATCalculationMethod>${el(
        "VATApplicable",
        String(input.supplierIsVatPayer)
      )}</ClassifiedTaxCategory>` +
      `<Item>${el("Description", item.description)}</Item>` +
      `</InvoiceLine>`
    );
  });

  let taxExclusiveAmount = 0;
  let taxInclusiveAmount = 0;
  const taxSubTotals = Array.from(vatBuckets.entries()).map(([rate, { base: b, vat: v }]) => {
    const bR = Math.round(b);
    const vR = Math.round(v);
    taxExclusiveAmount += bR;
    taxInclusiveAmount += bR + vR;
    return (
      `<TaxSubTotal>` +
      el("TaxableAmount", bR) +
      el("TaxAmount", vR) +
      el("TaxInclusiveAmount", bR + vR) +
      el("AlreadyClaimedTaxableAmount", 0) +
      el("AlreadyClaimedTaxAmount", 0) +
      el("AlreadyClaimedTaxInclusiveAmount", 0) +
      el("DifferenceTaxableAmount", bR) +
      el("DifferenceTaxAmount", vR) +
      el("DifferenceTaxInclusiveAmount", bR + vR) +
      `<TaxCategory>${el("Percent", rate)}${el("TaxScheme", "VAT")}${el("VATApplicable", String(input.supplierIsVatPayer))}</TaxCategory>` +
      `</TaxSubTotal>`
    );
  });
  const taxAmountTotal = taxInclusiveAmount - taxExclusiveAmount;
  const roundingAmount = input.total - taxInclusiveAmount;

  const account = splitAccountNumber(input.bankAccountNumber);
  const paymentMeans = input.iban
    ? `<PaymentMeans><Payment>` +
      el("PaidAmount", input.total) +
      `<PaymentMeansCode>42</PaymentMeansCode>` +
      `<Details>` +
      el("PaymentDueDate", isoDate(input.dueDate)) +
      el("ID", account.id) +
      el("BankCode", account.bankCode) +
      el("Name", input.supplier.name) +
      el("IBAN", input.iban) +
      el("BIC", input.bic) +
      (input.variableSymbol ? el("VariableSymbol", input.variableSymbol) : "") +
      `</Details>` +
      `</Payment></PaymentMeans>`
    : "";

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Invoice xmlns="${NS}" version="6.0.2">` +
    `<DocumentType>1</DocumentType>` +
    el("ID", input.number) +
    el("UUID", randomUUID()) +
    el("IssueDate", isoDate(input.issuedAt)) +
    el("TaxPointDate", isoDate(input.issuedAt)) +
    el("VATApplicable", String(input.supplierIsVatPayer)) +
    `<ElectronicPossibilityAgreementReference></ElectronicPossibilityAgreementReference>` +
    el("LocalCurrencyCode", input.currency) +
    `<CurrRate>1</CurrRate>` +
    `<RefCurrRate>1</RefCurrRate>` +
    party("AccountingSupplierParty", input.supplier) +
    party("AccountingCustomerParty", input.customer) +
    `<InvoiceLines>${lines.join("")}</InvoiceLines>` +
    `<TaxTotal>${taxSubTotals.join("")}${el("TaxAmount", taxAmountTotal)}</TaxTotal>` +
    `<LegalMonetaryTotal>` +
    el("TaxExclusiveAmount", taxExclusiveAmount) +
    el("TaxInclusiveAmount", taxInclusiveAmount) +
    el("AlreadyClaimedTaxExclusiveAmount", 0) +
    el("AlreadyClaimedTaxInclusiveAmount", 0) +
    el("DifferenceTaxExclusiveAmount", taxExclusiveAmount) +
    el("DifferenceTaxInclusiveAmount", taxInclusiveAmount) +
    (roundingAmount !== 0 ? el("PayableRoundingAmount", roundingAmount) : "") +
    el("PaidDepositsAmount", 0) +
    el("PayableAmount", input.total) +
    `</LegalMonetaryTotal>` +
    paymentMeans +
    `</Invoice>`;

  return xml;
}
