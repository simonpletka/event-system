import { cache } from "react";
import type { CurrencyCode } from "@/lib/format";

type ForeignCurrency = Exclude<CurrencyCode, "CZK">;

/**
 * Last-resort estimate if the CNB fetch itself fails (network hiccup, CNB
 * down) — better than silently treating a foreign amount as if it were
 * already CZK (which would be wildly wrong, not just approximate). Rough
 * rates as of 2026, not maintained day-to-day; the live fetch is what
 * actually matters and this only ever kicks in on a genuine outage.
 */
const FALLBACK_RATE: Record<ForeignCurrency, number> = { EUR: 24.5, USD: 21 };

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * One day's CNB central-bank fixing rates (CZK per 1 unit of foreign
 * currency), cache()-deduped per render pass so a report spanning many
 * invoice dates doesn't refetch the same day twice. CNB's daily.txt already
 * resolves a weekend/holiday date to the last published business day's rate
 * and clamps a future date to today's — a document's own issuedAt can
 * always be passed straight through with no day-walking logic here.
 */
const fetchCnbFixing = cache(async function fetchCnbFixing(key: string): Promise<Partial<Record<ForeignCurrency, number>>> {
  const [y, m, d] = key.split("-");
  const url = `https://www.cnb.cz/en/financial-markets/foreign-exchange-market/central-bank-exchange-rate-fixing/central-bank-exchange-rate-fixing/daily.txt?date=${d}.${m}.${y}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return {};
    const text = await res.text();
    const rates: Partial<Record<ForeignCurrency, number>> = {};
    for (const line of text.split("\n").slice(2)) {
      const [, , amountStr, code, rateStr] = line.split("|");
      if (code !== "EUR" && code !== "USD") continue;
      const amount = Number(amountStr);
      const rate = Number(rateStr);
      if (amount > 0 && Number.isFinite(rate)) rates[code] = rate / amount;
    }
    return rates;
  } catch (e) {
    console.error("CNB exchange-rate fetch failed:", e);
    return {};
  }
});

/** CZK per 1 unit of `currency` on `date`, per the CNB fixing (or FALLBACK_RATE if the fetch failed). */
export async function czkRate(currency: ForeignCurrency, date: Date): Promise<number> {
  const rates = await fetchCnbFixing(dateKey(date));
  return rates[currency] ?? FALLBACK_RATE[currency];
}

/** Converts a single amount to CZK using the CNB rate on `date`. CZK amounts pass through unchanged. */
export async function toCzk(amount: number, currency: CurrencyCode, date: Date): Promise<number> {
  if (currency === "CZK") return amount;
  const rate = await czkRate(currency, date);
  return Math.round(amount * rate);
}

/** Converts a batch of dated amounts to CZK in parallel — the per-item building block for both flat sums and bucketed aggregates (by month, by project, ...). */
export async function toCzkBatch<T extends { amount: number; currency: CurrencyCode; date: Date }>(
  items: T[]
): Promise<(T & { czkAmount: number })[]> {
  return Promise.all(items.map(async (item) => ({ ...item, czkAmount: await toCzk(item.amount, item.currency, item.date) })));
}
