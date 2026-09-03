/**
 * Classifies an invoice's VAT regime from the customer's VAT ID (DIČ) prefix,
 * for a Czech VAT-registered supplier:
 *
 *  - `domestic` — Czech customer (`CZ…`), or no/unrecognised DIČ. Czech VAT
 *    (21 / 12 %) applies as normal.
 *  - `eu` — customer registered for VAT in another EU member state. Supply is
 *    reported as "dodání zboží/služby do jiného členského státu" (reverse
 *    charge), invoiced at 0 % Czech VAT, and listed in the EC Sales List
 *    (souhrnné hlášení).
 *  - `export` — everything else (third country). 0 % Czech VAT, not in the EC
 *    Sales List.
 *
 * Heuristic only — a Czech company occasionally holds a foreign VAT number, and
 * vice versa. A per-invoice manual override is deliberately out of scope for now.
 */

export type VatRegime = "domestic" | "eu" | "export";

/** EU member-state VAT-ID prefixes, plus XI (Northern Ireland, post-Brexit goods). */
export const EU_VAT_PREFIXES = new Set([
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "EL", "ES", "FI", "FR", "HR",
  "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI",
  "SK", "XI",
]);

export function classifyRegime(dic: string | null | undefined): VatRegime {
  const prefix = (dic ?? "").trim().slice(0, 2).toUpperCase();
  if (prefix === "CZ") return "domestic";
  if (EU_VAT_PREFIXES.has(prefix)) return "eu";
  if (/^[A-Z]{2}/.test(prefix)) return "export";
  return "domestic";
}
