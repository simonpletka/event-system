"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import { getDictionary, type Locale } from "@/lib/dictionary";
import { MobileListRow } from "@/components/ui/MobileListRow";
import { CategoryManager } from "./CategoryManager";
import { freeTone, normalize, PillSwitch, TONE_DOT, TONE_TEXT } from "./shared";

export type CatalogCategory = { id: string; name: string; typeCount: number };
export type CatalogRow = {
  id: string;
  name: string;
  categoryId: string;
  units: number;
  freeToday: number;
  purchasePrice: number;
  rateMode: "AUTO" | "CUSTOM";
  ratePercent: number;
  dayRate: number;
};

const GRID = "grid grid-cols-[minmax(0,2.4fr)_minmax(0,0.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-4 items-center";

/** Every type is loaded, so the category, search and Free today filters run in the browser. */
export function GearCatalog({
  categories,
  rows,
  canManage,
  locale,
}: {
  categories: CatalogCategory[];
  rows: CatalogRow[];
  canManage: boolean;
  locale: Locale;
}) {
  const t = getDictionary(locale).gear;
  const [query, setQuery] = useState("");
  const [onlyFree, setOnlyFree] = useState<"all" | "free">("all");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);

  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const q = normalize(query.trim());
  const shown = rows.filter(
    (r) =>
      (!categoryId || r.categoryId === categoryId) &&
      (onlyFree === "all" || r.freeToday > 0) &&
      (!q || normalize(r.name).includes(q) || normalize(categoryName.get(r.categoryId) ?? "").includes(q))
  );
  const sections = categories
    .map((c) => ({ category: c, rows: shown.filter((r) => r.categoryId === c.id) }))
    .filter((s) => s.rows.length > 0);

  const rateCell = (r: CatalogRow) => (
    <span className="inline-flex items-center gap-2 justify-end">
      <span className="tabular-nums">{formatCurrency(r.dayRate)}</span>
      <span className={`tag tag-neutral ${r.rateMode === "CUSTOM" ? "!text-ink" : ""}`}>
        {r.rateMode === "CUSTOM" ? t.chipCustom : t.chipAuto(r.ratePercent)}
      </span>
    </span>
  );

  const freeCell = (r: CatalogRow) => {
    const tone = freeTone(r.freeToday, r.units);
    return (
      <span className={`inline-flex items-center gap-2 font-semibold tabular-nums ${TONE_TEXT[tone]}`}>
        <span aria-hidden className={`w-2 h-2 rounded-full ${TONE_DOT[tone]}`} />
        {r.freeToday} / {r.units}
        {r.units > 0 && r.freeToday === 0 && <span className="font-normal">· {t.allOut}</span>}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchShort}
          className="input flex-1 min-w-[220px] max-w-[460px]"
        />
        <PillSwitch
          label={t.filterFreeToday}
          value={onlyFree}
          onChange={setOnlyFree}
          options={[
            { value: "all", label: t.filterAll },
            { value: "free", label: t.filterFreeToday },
          ]}
        />
      </div>

      <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start">
        <nav aria-label={t.categories} className="card p-3 w-full md:w-[240px] shrink-0">
          <div className="heading-label px-2 pt-1 pb-2">{t.categories}</div>
          <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {[{ id: null as string | null, name: t.allGear, count: rows.length }, ...categories.map((c) => ({ id: c.id as string | null, name: c.name, count: c.typeCount }))].map(
              (c) => {
                const selected = c.id === categoryId;
                return (
                  <button
                    key={c.id ?? "all"}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setCategoryId(c.id)}
                    className={`shrink-0 flex items-center justify-between gap-3 px-3 min-h-[40px] rounded-xl text-[13.5px] font-medium text-left ${
                      selected ? "bg-accent/15 text-ink" : "text-ink/70 hover:bg-ink/5 hover:text-ink"
                    }`}
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="placeholder-text tabular-nums text-[12px]">{c.count}</span>
                  </button>
                );
              }
            )}
          </div>
          {canManage && (
            <button type="button" onClick={() => setManaging(true)} className="mt-2 w-full text-left px-3 min-h-[40px] rounded-xl text-[13px] font-semibold text-accent hover:bg-ink/5">
              {categories.length === 0 ? `+ ${t.addCategory}` : t.manageCategories}
            </button>
          )}
        </nav>

        <section aria-label={t.colGear} className="card p-4 md:p-5 flex-1 min-w-0 w-full">
          {rows.length === 0 ? (
            <p className="text-[13px] placeholder-text py-3">{t.empty}</p>
          ) : sections.length === 0 ? (
            <p className="text-[13px] placeholder-text py-3">{categoryId && !q && onlyFree === "all" ? t.emptyCategory : t.noMatch}</p>
          ) : (
            <>
              <div className={`${GRID} hidden md:grid heading-label !text-[10px] pb-2 border-b border-ink/10`}>
                <span>{t.colGear}</span>
                <span>{t.colUnits}</span>
                <span>{t.colFreeToday}</span>
                <span className="text-right">{t.colBoughtFor}</span>
                <span className="text-right">{t.colDayRate}</span>
              </div>
              {sections.map(({ category, rows: sectionRows }) => (
                <div key={category.id}>
                  <div className="flex items-baseline justify-between pt-5 pb-1.5 px-1">
                    <span className="text-[12px] font-bold tracking-[0.08em] uppercase text-ink/70">{category.name}</span>
                    <span className="text-[12px] placeholder-text">{t.typesCount(category.typeCount)}</span>
                  </div>
                  <ul>
                    {sectionRows.map((r) => (
                      <li key={r.id} className="border-t border-ink/8">
                        <Link href={`/gear/${r.id}`} className={`${GRID} hidden md:grid py-3 px-1 rounded-xl hover:bg-ink/5 group text-[14px]`}>
                          <span className="font-semibold truncate group-hover:text-accent">{r.name}</span>
                          <span className="tabular-nums">{r.units}</span>
                          {freeCell(r)}
                          <span className="text-right tabular-nums placeholder-text">{formatCurrency(r.purchasePrice)}</span>
                          {rateCell(r)}
                        </Link>
                        <div className="md:hidden">
                          <MobileListRow
                            href={`/gear/${r.id}`}
                            title={r.name}
                            meta={
                              <span className="inline-flex items-center gap-2">
                                {freeCell(r)}
                                <span>· {formatCurrency(r.purchasePrice)}</span>
                              </span>
                            }
                            trailing={formatCurrency(r.dayRate)}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="flex flex-wrap justify-between gap-2 pt-4 mt-2 border-t border-ink/10 text-[12px] placeholder-text">
                <span>{t.showing(shown.length, rows.length)}</span>
                <span>{t.rateFootnote}</span>
              </div>
            </>
          )}
        </section>
      </div>

      {managing && <CategoryManager categories={categories} locale={locale} onClose={() => setManaging(false)} />}
    </div>
  );
}
