"use client";

import { usePathname } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/dictionary";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";

export function FinanceTabs({ counts, locale }: { counts: { quotes: number; invoices: number; expenses: number }; locale: Locale }) {
  const pathname = usePathname();
  const t = getDictionary(locale).finance;
  const tabs = [
    { value: "quotes", href: "/finance/quotes", label: t.quotesTab(counts.quotes) },
    { value: "invoices", href: "/finance/invoices", label: t.invoicesTab(counts.invoices) },
    { value: "expenses", href: "/finance/expenses", label: t.expensesTab(counts.expenses) },
    { value: "reports", href: "/finance/reports", label: t.reportsTab },
  ];
  const active = tabs.find((tab) => pathname.startsWith(tab.href))?.value ?? tabs[0].value;

  return <SegmentedTabs options={tabs} active={active} />;
}
