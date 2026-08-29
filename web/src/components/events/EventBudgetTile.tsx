import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";

/**
 * Read-only budget card for the event Finance tab. The `basis` line
 * ("70% of the 340 000 Kč quoted value") is passed in as null for roles that
 * may see the budget figure but not how it relates to the client quote
 * (Producer) — only Admin/Accountant get it.
 */
export function EventBudgetTile({
  t,
  amount,
  basis,
  spent,
  spendRatio,
  plannedMargin,
  actualMargin,
  editHref,
}: {
  t: Dictionary["events"];
  amount: number | null;
  basis: string | null;
  spent: number;
  spendRatio: number | null;
  plannedMargin: number | null;
  actualMargin: number;
  editHref: string | null;
}) {
  const tb = t.budget;
  const over = spendRatio !== null && spendRatio > 1;
  const warn = spendRatio !== null && spendRatio >= 0.85 && spendRatio <= 1;
  const remaining = amount === null ? 0 : amount - spent;

  return (
    <div className="card p-[18px] border-accent/25">
      <div className="flex items-center justify-between mb-1">
        <span className="heading-label !text-[9px]">{tb.title}</span>
        {editHref && (
          <Link href={editHref} className="text-[8px] tracking-[0.14em] uppercase font-semibold placeholder-text hover:text-accent">
            {tb.edit}
          </Link>
        )}
      </div>

      {amount === null ? (
        <p className="text-[12px] placeholder-text mt-1">
          {tb.notSet}
          {editHref && (
            <>
              {" "}
              <Link href={editHref} className="text-accent hover:underline">
                {tb.setBudget}
              </Link>
            </>
          )}
        </p>
      ) : (
        <>
          <div className="text-[24px] font-bold tracking-tight tabular-nums">{formatCurrency(amount)}</div>
          {basis && <div className="text-[11px] placeholder-text mt-0.5">{basis}</div>}

          <div className="mt-3.5">
            <div className="h-2 rounded-full bg-ink/10 overflow-hidden">
              <div
                className={`h-full rounded-full ${over ? "bg-warning" : warn ? "bg-attention" : "bg-ink/50"}`}
                style={{ width: `${Math.min(100, (spendRatio ?? 0) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-[11px]">
              <span className="tabular-nums">{tb.spentLabel(formatCurrency(spent))}</span>
              <span className={`tabular-nums ${remaining < 0 ? "text-warning" : "placeholder-text"}`}>
                {remaining < 0 ? tb.overLabel(formatCurrency(-remaining)) : tb.leftLabel(formatCurrency(remaining))}
              </span>
            </div>
          </div>

          <div className="mt-3 pt-1">
            {plannedMargin !== null && (
              <div className="flex justify-between py-1.5 text-[13px] border-t border-ink/8">
                <span className="text-ink/72">{tb.plannedMargin}</span>
                <span className={`font-semibold tabular-nums ${plannedMargin >= 0 ? "text-positive" : "text-warning"}`}>
                  {formatCurrency(plannedMargin)}
                </span>
              </div>
            )}
            <div className="flex justify-between py-1.5 text-[13px] border-t border-ink/8">
              <span className="text-ink/72">{tb.actualMargin}</span>
              <span className="font-semibold tabular-nums">{formatCurrency(actualMargin)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** The PERCENT / FIXED "basis" line for the budget tile — null for NONE. */
export function budgetBasisLabel(
  budget: { type: "NONE" | "PERCENT" | "FIXED"; value: number; amount: number | null },
  quotedValue: number,
  t: Dictionary["events"]["budget"],
): string | null {
  if (budget.type === "PERCENT") return t.basisPercent(budget.value, formatCurrency(quotedValue));
  if (budget.type === "FIXED") {
    const approxPct = quotedValue > 0 ? Math.round(((budget.amount ?? 0) / quotedValue) * 100) : 0;
    return t.basisFixed(approxPct, formatCurrency(quotedValue));
  }
  return null;
}
