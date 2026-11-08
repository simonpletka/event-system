"use client";

import { usePathname } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/dictionary";
import { SlidingTabs } from "@/components/ui/SlidingTabs";

export function FinanceTabs({
  counts,
  locale,
  canFinance = true,
}: {
  counts: { quotes: number; invoices: number; expenses: number };
  locale: Locale;
  /** Expenses-only roles see just the Expenses tab. */
  canFinance?: boolean;
}) {
  const pathname = usePathname();
  const t = getDictionary(locale).finance;
  const tabs = [
    ...(canFinance
      ? [
          { value: "quotes", href: "/finance/quotes", label: t.quotesTab(counts.quotes) },
          { value: "invoices", href: "/finance/invoices", label: t.invoicesTab(counts.invoices) },
        ]
      : []),
    { value: "expenses", href: "/finance/expenses", label: t.expensesTab(counts.expenses) },
    ...(canFinance ? [{ value: "reports", href: "/finance/reports", label: t.reportsTab }] : []),
  ];
  const active = tabs.find((tab) => pathname.startsWith(tab.href))?.value ?? tabs[0].value;

  if (tabs.length === 1) return null;

  return <SlidingTabs tabs={tabs} active={active} />;
}
