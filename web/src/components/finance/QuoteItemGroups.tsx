"use client";

import { useState } from "react";
import { formatCurrency, type CurrencyCode } from "@/lib/format";
import type { Dictionary } from "@/lib/dictionary";
import {
  blankGroupItem,
  duplicateGroupNames,
  itemsFromGroups,
  newKey,
  type GroupItem,
  type ItemGroup,
} from "@/lib/quote-groups";
import { useConfirmDialog } from "@/components/ui/ConfirmDialogProvider";

type T = Dictionary["finance"]["lineItems"];

// One grid for the column heads, every item row and each group's header, so
// subtotals line up under "Total". Phone: description across the row, then
// qty · unit price · VAT · remove (no line-total column).
const ROW_GRID =
  "grid grid-cols-[repeat(3,minmax(0,1fr))_28px] md:grid-cols-[22px_minmax(0,1fr)_64px_112px_64px_104px_28px] gap-x-2 gap-y-1.5 items-center";
const HEAD = "text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/50";
const ICON_BTN =
  "grid place-items-center w-7 h-7 rounded-full text-[15px] leading-none text-ink/40 hover:text-warning hover:bg-warning/10 transition-colors";
const LINK_BTN = "text-[12px] font-medium text-ink/55 hover:text-accent transition-colors";
const NUM_INPUT = "input !py-1.5 text-right tabular-nums";

function moved<X>(list: X[], i: number, dir: -1 | 1): X[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/**
 * Quote line items edited inside named groups (the category headings on the
 * quote). A group is created right here: type a new name (used on this quote
 * only) or pick one of the saved categories from Settings. Items take their
 * group's name as their category; there's no per-item category field.
 *
 * The visible inputs have no `name`. The form gets hidden itemDescription /
 * itemQuantity / itemUnitPrice / itemVatRate / itemCategory fields built from
 * the groups, so the server sees the same flat list as before.
 */
export function QuoteItemGroups({
  groups,
  loose,
  onChange,
  currency = "CZK",
  savedCategories,
  t,
}: {
  groups: ItemGroup[];
  /** Items with no group, shown last (as on the quote). */
  loose: GroupItem[];
  onChange: (groups: ItemGroup[], loose: GroupItem[]) => void;
  currency?: CurrencyCode;
  savedCategories: string[];
  t: T;
}) {
  const { confirm } = useConfirmDialog();
  const [newName, setNewName] = useState("");
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const flat = itemsFromGroups(groups, loose);
  const base = flat.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const vat = flat.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0);
  const duplicates = duplicateGroupNames(groups);
  const usedNames = new Set(groups.map((g) => g.name.trim().toLowerCase()));
  const unusedSaved = savedCategories.filter((c) => !usedNames.has(c.trim().toLowerCase()));

  const setGroups = (next: ItemGroup[]) => onChange(next, loose);
  const setLoose = (next: GroupItem[]) => onChange(groups, next);
  const updateGroup = (key: string, patch: Partial<ItemGroup>) => setGroups(groups.map((g) => (g.key === key ? { ...g, ...patch } : g)));

  function addGroup(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const item = blankGroupItem();
    setGroups([...groups, { key: newKey(), name: trimmed, items: [item] }]);
    setFocusKey(item.key);
    setNewName("");
  }

  async function removeGroup(group: ItemGroup) {
    const filled = group.items.filter((i) => i.description.trim()).length;
    if (filled > 0 && !(await confirm(t.confirmRemoveGroup(group.name || "—", filled), { confirmLabel: t.removeGroup }))) return;
    setGroups(groups.filter((g) => g.key !== group.key));
  }

  function arrows(onUp: () => void, onDown: () => void, first: boolean, last: boolean, upTitle: string, downTitle: string) {
    return (
      <div className="flex flex-col items-center text-ink/45">
        <button type="button" onClick={onUp} disabled={first} className="text-[9px] leading-[11px] hover:text-ink disabled:opacity-20" title={upTitle}>
          ▲
        </button>
        <button type="button" onClick={onDown} disabled={last} className="text-[9px] leading-[11px] hover:text-ink disabled:opacity-20" title={downTitle}>
          ▼
        </button>
      </div>
    );
  }

  function itemRows(items: GroupItem[], setItems: (next: GroupItem[]) => void) {
    const update = (key: string, patch: Partial<GroupItem>) => setItems(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));
    return items.map((item, i) => (
      <div key={item.key} className={ROW_GRID}>
        <div className="hidden md:flex justify-center">
          {arrows(
            () => setItems(moved(items, i, -1)),
            () => setItems(moved(items, i, 1)),
            i === 0,
            i === items.length - 1,
            t.moveUp,
            t.moveDown
          )}
        </div>
        <input
          value={item.description}
          onChange={(e) => update(item.key, { description: e.target.value })}
          placeholder={t.descriptionPlaceholder}
          aria-label={t.colDescription}
          autoFocus={item.key === focusKey}
          className="input !py-1.5 col-span-4 md:col-span-1"
        />
        {/* Phone: the column headings sit above the numbers, so each item labels its own. */}
        <span className={`${HEAD} md:hidden`}>{t.colQty}</span>
        <span className={`${HEAD} md:hidden`}>{t.colUnitPrice}</span>
        <span className={`${HEAD} md:hidden`}>{t.colVat}</span>
        <span className="md:hidden" />
        <input
          type="number"
          min={1}
          value={item.quantity}
          onChange={(e) => update(item.key, { quantity: Number(e.target.value) || 1 })}
          onFocus={(e) => e.target.select()}
          aria-label={t.colQty}
          title={t.colQty}
          className={NUM_INPUT}
        />
        <input
          type="number"
          min={0}
          value={item.unitPrice}
          onChange={(e) => update(item.key, { unitPrice: Number(e.target.value) || 0 })}
          onFocus={(e) => e.target.select()}
          aria-label={t.colUnitPrice}
          title={t.colUnitPrice}
          className={NUM_INPUT}
        />
        <input
          type="number"
          min={0}
          max={100}
          value={item.vatRate}
          onChange={(e) => update(item.key, { vatRate: Number(e.target.value) || 0 })}
          onFocus={(e) => e.target.select()}
          aria-label={t.colVat}
          title={t.colVat}
          className={NUM_INPUT}
        />
        <span className="hidden md:block text-right text-[13px] tabular-nums text-ink/80">
          {formatCurrency(item.quantity * item.unitPrice, currency)}
        </span>
        <button
          type="button"
          onClick={() => setItems(items.filter((x) => x.key !== item.key))}
          title={t.removeBtn}
          aria-label={t.removeBtn}
          className={ICON_BTN}
        >
          ×
        </button>
      </div>
    ));
  }

  function addItemTo(group: ItemGroup) {
    const item = blankGroupItem();
    updateGroup(group.key, { items: [...group.items, item] });
    setFocusKey(item.key);
  }

  const subtotal = (items: GroupItem[]) => items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  return (
    <div className="flex flex-col gap-3">
      {/* What the server reads: one flat list, each item tagged with its group's name. */}
      {flat.map((item, i) => (
        <div key={i} hidden>
          <input type="hidden" name="itemDescription" value={item.description} />
          <input type="hidden" name="itemQuantity" value={item.quantity} />
          <input type="hidden" name="itemUnitPrice" value={item.unitPrice} />
          <input type="hidden" name="itemVatRate" value={item.vatRate} />
          <input type="hidden" name="itemCategory" value={item.category} />
        </div>
      ))}

      <p className="text-[12px] text-ink/55">{t.groupsHint}</p>

      {/* All groups in one table: column heads once, each group a section with its header row and items. */}
      <div className="card overflow-hidden">
        <div className={`${ROW_GRID} !hidden md:!grid px-4 pt-3 pb-2 border-b border-ink/10`}>
          <span />
          <span className={HEAD}>{t.colDescription}</span>
          <span className={`${HEAD} text-right`}>{t.colQty}</span>
          <span className={`${HEAD} text-right`}>{t.colUnitPrice}</span>
          <span className={`${HEAD} text-right`}>{t.colVat}</span>
          <span className={`${HEAD} text-right`}>{t.colTotal}</span>
          <span />
        </div>

        {groups.length === 0 && loose.length === 0 && <p className="px-4 py-4 text-[13px] text-ink/55">{t.noGroupsYet}</p>}

        {groups.map((group, gi) => {
          const duplicate = duplicates.has(group.name.trim().toLowerCase());
          const empty = group.items.length === 0;
          return (
            <section key={group.key} className="px-4 py-3 flex flex-col gap-1.5 border-b border-ink/10">
              <div className="flex items-center gap-2 md:grid md:grid-cols-[22px_minmax(0,1fr)_104px_28px] md:gap-x-2">
                <div className="flex justify-center">
                  {arrows(
                    () => setGroups(moved(groups, gi, -1)),
                    () => setGroups(moved(groups, gi, 1)),
                    gi === 0,
                    gi === groups.length - 1,
                    t.moveGroupUp,
                    t.moveGroupDown
                  )}
                </div>
                <input
                  value={group.name}
                  onChange={(e) => updateGroup(group.key, { name: e.target.value })}
                  placeholder={t.groupNamePlaceholder}
                  aria-label={t.groupNamePlaceholder}
                  required
                  list="quote-saved-categories"
                  className={`flex-1 min-w-0 bg-transparent rounded-lg border px-2 py-1 -ml-2 text-[14px] font-semibold text-ink outline-none transition-colors placeholder:text-ink/35 hover:border-ink/20 focus:border-ink ${
                    duplicate ? "border-warning" : "border-transparent"
                  }`}
                />
                <span className={`shrink-0 text-right text-[13px] font-semibold tabular-nums ${empty ? "text-ink/35" : "text-ink"}`}>
                  {formatCurrency(subtotal(group.items), currency)}
                </span>
                <button type="button" onClick={() => removeGroup(group)} title={t.removeGroup} aria-label={t.removeGroup} className={ICON_BTN}>
                  ×
                </button>
              </div>
              {duplicate && <p className="text-[12px] text-warning md:pl-[30px]">{t.duplicateGroup}</p>}
              {itemRows(group.items, (items) => updateGroup(group.key, { items }))}
              <div className="flex items-baseline gap-3 md:pl-[30px]">
                <button type="button" onClick={() => addItemTo(group)} className={LINK_BTN}>
                  + {t.addItem}
                </button>
                {empty && <span className="text-[12px] text-ink/40">{t.emptyGroup}</span>}
              </div>
            </section>
          );
        })}

        {loose.length > 0 && (
          <section className="px-4 py-3 flex flex-col gap-1.5 border-b border-ink/10">
            <div className="text-[14px] font-semibold text-ink/60 md:pl-[30px]">{t.ungrouped}</div>
            {itemRows(loose, setLoose)}
          </section>
        )}

        <datalist id="quote-saved-categories">
          {savedCategories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        {/* New group: typed here (this quote only) or one of the saved categories. */}
        <div className="px-4 py-3 flex flex-col gap-2.5 bg-ink/[0.02]">
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                // Enter adds the group instead of submitting the whole quote.
                if (e.key === "Enter") {
                  e.preventDefault();
                  addGroup(newName);
                }
              }}
              placeholder={t.newGroupPlaceholder}
              aria-label={t.newGroupPlaceholder}
              className="input !py-1.5 flex-1 min-w-0"
            />
            <button type="button" onClick={() => addGroup(newName)} disabled={!newName.trim()} className="btno shrink-0 disabled:opacity-40">
              + {t.addGroup}
            </button>
          </div>
          {unusedSaved.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] text-ink/50 mr-1">{t.savedCategories}:</span>
              {unusedSaved.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => addGroup(c)}
                  className="rounded-full border border-ink/20 px-3 py-1 text-[12px] text-ink/85 hover:border-accent hover:text-ink transition-colors"
                >
                  + {c}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              const item = blankGroupItem();
              setLoose([...loose, item]);
              setFocusKey(item.key);
            }}
            className={`self-start ${LINK_BTN}`}
          >
            + {t.addUngroupedItem}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap justify-end items-baseline gap-x-8 gap-y-1 pr-1">
        <div className="flex items-baseline gap-2 text-[13px] tabular-nums">
          <span className={HEAD}>{t.base}</span>
          {formatCurrency(base, currency)}
        </div>
        <div className="flex items-baseline gap-2 text-[13px] tabular-nums">
          <span className={HEAD}>{t.vat}</span>
          {formatCurrency(vat, currency)}
        </div>
        <div className="flex items-baseline gap-2">
          <span className={HEAD}>{t.toPay}</span>
          <span className="text-[20px] font-semibold tabular-nums">{formatCurrency(base + vat, currency)}</span>
        </div>
      </div>
    </div>
  );
}
