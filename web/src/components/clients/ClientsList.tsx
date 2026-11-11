"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import { getDictionary, type Locale } from "@/lib/dictionary";

export type ClientRow = {
  id: string;
  name: string;
  ico: string;
  href: string;
  contactCount: number;
  projectCount: number;
  totalCharged: number;
  totalMixed: boolean;
};

/** Diacritics-insensitive, so "nova" finds "Nová Hora". */
function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** The "All clients" card. Every client is already loaded, so search filters as you type with no round-trip. */
export function ClientsList({ clients, locale }: { clients: ClientRow[]; locale: Locale }) {
  const tc = getDictionary(locale).clients;
  const [query, setQuery] = useState("");
  const q = normalize(query.trim());
  const shown = q ? clients.filter((c) => normalize(c.name).includes(q)) : clients;
  const anyMixed = shown.some((c) => c.totalMixed);

  return (
    <section aria-label={tc.allClients} className="card p-4 md:p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h2 className="heading-label !text-[12px] font-bold">
            {tc.allClients} <span className="placeholder-text font-normal">· {tc.shownOf(shown.length, clients.length)}</span>
          </h2>
          <p className="text-[12.5px] placeholder-text mt-1">{tc.totalsExclVat}</p>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tc.searchPlaceholder}
          aria-label={tc.searchPlaceholder}
          className="input text-[12px] py-2 w-full sm:w-[240px]"
        />
      </div>

      {shown.length === 0 ? (
        <p className="text-[13px] placeholder-text py-3">{tc.noClientsMatch}</p>
      ) : (
        <ul className="flex flex-col">
          {shown.map((c) => (
            <li key={c.id} className="border-t border-ink/8 first:border-t-0">
              <Link href={c.href} className="group flex items-center gap-4 py-3.5 px-2 -mx-2 rounded-xl hover:bg-ink/5">
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-bold truncate group-hover:text-accent">{c.name}</span>
                  <span className="block text-[13px] placeholder-text">
                    {tc.colIco} {c.ico || "—"}
                  </span>
                </span>
                <span className="hidden md:block text-[13px] placeholder-text whitespace-nowrap w-[96px]">{tc.contactsCount(c.contactCount)}</span>
                <span className="hidden md:block text-[13px] placeholder-text whitespace-nowrap w-[96px]">{tc.projectsCount(c.projectCount)}</span>
                <span className={`text-right shrink-0 ${c.totalCharged === 0 ? "opacity-45" : ""}`}>
                  <span className="block heading-label !text-[9px]">{tc.totalChargedLabel}</span>
                  <span className="block text-[15px] font-semibold tabular-nums whitespace-nowrap group-hover:text-accent">
                    {formatCurrency(c.totalCharged)}
                    {c.totalMixed && <span className="placeholder-text">&thinsp;*</span>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {anyMixed && <p className="label mt-3">{tc.mixedCurrencyNote}</p>}
    </section>
  );
}
