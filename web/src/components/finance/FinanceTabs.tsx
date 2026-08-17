"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function FinanceTabs({ counts }: { counts: { quotes: number; invoices: number; expenses: number } }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/finance/quotes", label: `Quotes ${counts.quotes}` },
    { href: "/finance/invoices", label: `Invoices ${counts.invoices}` },
    { href: "/finance/expenses", label: `Expenses ${counts.expenses}` },
    { href: "/finance/reports", label: "Reports" },
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
