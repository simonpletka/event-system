import type { BudgetType } from "@/generated/prisma/enums";

export type ResolvedBudget = {
  type: BudgetType;
  /** Raw stored value: a percent (0-300) when PERCENT, a CZK amount when FIXED, 0 when NONE. */
  value: number;
  /** The budget as a concrete CZK amount, or null when no budget is set. */
  amount: number | null;
};

/**
 * The event budget is a manually-set internal spend cap. It's stored either
 * as a percentage of the client-facing quotedValue or as a flat amount;
 * this resolves both to a single CZK figure (null when unset). Percent math
 * rounds to whole CZK to match how every other amount in the app is stored.
 */
export function resolveEventBudget(event: {
  budgetType: BudgetType;
  budgetValue: number;
  quotedValue: number;
}): ResolvedBudget {
  if (event.budgetType === "PERCENT") {
    return { type: "PERCENT", value: event.budgetValue, amount: Math.round((event.quotedValue * event.budgetValue) / 100) };
  }
  if (event.budgetType === "FIXED") {
    return { type: "FIXED", value: event.budgetValue, amount: event.budgetValue };
  }
  return { type: "NONE", value: 0, amount: null };
}

/** Normalises a submitted budget type + value: clamps percent to 0-300, amount to >= 0, both to whole numbers. */
export function normaliseBudgetInput(type: string, rawValue: number): { budgetType: BudgetType; budgetValue: number } {
  if (type !== "PERCENT" && type !== "FIXED") return { budgetType: "NONE", budgetValue: 0 };
  const n = Number.isFinite(rawValue) ? rawValue : 0;
  const budgetValue = type === "PERCENT" ? Math.max(0, Math.min(300, Math.round(n))) : Math.max(0, Math.round(n));
  return { budgetType: type, budgetValue };
}
