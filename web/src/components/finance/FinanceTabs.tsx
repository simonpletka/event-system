"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/dictionary";

export function FinanceTabs({ counts, locale }: { counts: { quotes: number; invoices: number; expenses: number }; locale: Locale }) {
  const pathname = usePathname();
  const t = getDictionary(locale).finance;
  const tabs = [
    { href: "/finance/quotes", label: t.quotesTab(counts.quotes) },
    { href: "/finance/invoices", label: t.invoicesTab(counts.invoices) },
    { href: "/finance/expenses", label: t.expensesTab(counts.expenses) },
    { href: "/finance/reports", label: t.reportsTab },
  ];

  return (
    <div className="flex gap-3.5 border-b border-ink/20 flex-wrap">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`text-[9px] tracking-[0.14em] uppercase pb-1.5 border-b-2 ${
              active ? "border-accent text-accent" : "border-transparent placeholder-text hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
