export type CurrencyCode = "CZK" | "EUR" | "USD";

const CURRENCY_LOCALE: Record<CurrencyCode, string> = { CZK: "cs-CZ", EUR: "de-DE", USD: "en-US" };

// Defaults to CZK so every pre-existing call site (event/expense/report
// amounts, none of which carry a currency of their own — see CLAUDE.md's
// "no FX conversion, stats stay CZK" decision) keeps working unchanged.
// Only quote/invoice line items and totals pass an explicit currency.
export function formatCurrency(amount: number, currency: CurrencyCode = "CZK") {
  return new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat("en-GB", opts).format(date);
}

export function formatDateRange(start: Date, end: Date) {
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) return formatDate(start);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.getDate()}–${formatDate(end)}`;
  }
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function toDateTimeLocal(date: Date | null | undefined) {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Single-line rendering of a Client's structured address, for contexts (like Event.companyAddress) that only take one string. */
export function formatClientAddress(c: { street: string; city: string; postCode: string; state: string }) {
  const cityLine = [c.postCode, c.city].filter(Boolean).join(" ");
  return [c.street, cityLine, c.state].filter(Boolean).join(", ");
}

/** Short axis-label form ("45 tis. Kč") for chart gridlines, where the full formatCurrency would be too wide. */
export function formatCompactCurrency(amount: number, currency: CurrencyCode = "CZK") {
  return new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

/** Rounds a chart's max value up to a "nice" gridline ceiling (1/2/5/10 × a power of ten) so axis labels land on round numbers. */
export function niceAxisMax(max: number): number {
  if (max <= 0) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  const residual = max / magnitude;
  const step = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  return step * magnitude;
}

export function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}
