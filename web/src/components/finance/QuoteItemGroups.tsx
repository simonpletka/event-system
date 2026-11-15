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

// Phone: description across the row, then qty · unit price · VAT · remove. Wider: one row, with reorder arrows first.
const ROW_GRID = "grid grid-cols-[repeat(3,minmax(0,1fr))_28px] md:grid-cols-[22px_minmax(0,1fr)_76px_120px_76px_32px] gap-2 items-center";
const HEAD = "heading-label !text-[9px] !font-bold";

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

  function itemRows(items: GroupItem[], setItems: (next: GroupItem[]) => void) {
    const update = (key: string, patch: Partial<GroupItem>) => setItems(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));
    return items.map((item, i) => (
      <div key={item.key} className={ROW_GRID}>
        <div className="hidden md:flex flex-col">
          <button type="button" onClick={() => setItems(moved(items, i, -1))} disabled={i === 0} className="text-[9px] leading-none disabled:opacity-20" title={t.moveUp}>
            ▲
          </button>
          <button
            type="button"
            onClick={() => setItems(moved(items, i, 1))}
            disabled={i === items.length - 1}
            className="text-[9px] leading-none disabled:opacity-20"
            title={t.moveDown}
          >
            ▼
          </button>
        </div>
        <input
          value={item.description}
          onChange={(e) => update(item.key, { description: e.target.value })}
          placeholder={t.descriptionPlaceholder}
          aria-label={t.colDescription}
          autoFocus={item.key === focusKey}
          className="input col-span-4 md:col-span-1"
        />
        {/* Phone: the column headings sit above the description, so each item labels its own numbers. */}
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
          className="input"
        />
        <input
          type="number"
          min={0}
          value={item.unitPrice}
          onChange={(e) => update(item.key, { unitPrice: Number(e.target.value) || 0 })}
          onFocus={(e) => e.target.select()}
          aria-label={t.colUnitPrice}
          title={t.colUnitPrice}
          className="input"
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
          className="input"
        />
        <button
          type="button"
          onClick={() => setItems(items.filter((x) => x.key !== item.key))}
          title={t.removeBtn}
          aria-label={t.removeBtn}
          className="grid place-items-center w-7 h-7 rounded-full text-ink/45 hover:text-warning hover:bg-warning/10 transition-colors"
        >
          ×
        </button>
      </div>
    ));
  }

  function columnHeads() {
    return (
      <div className={`${ROW_GRID} !hidden md:!grid`}>
        <span className="hidden md:block" />
        <span className={`${HEAD} hidden md:block`}>{t.colDescription}</span>
        <span className={HEAD}>{t.colQty}</span>
        <span className={HEAD}>{t.colUnitPrice}</span>
        <span className={HEAD}>{t.colVat}</span>
        <span />
      </div>
    );
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

      <p className="text-[11px] placeholder-text">{t.groupsHint}</p>

      {groups.length === 0 && loose.length === 0 && <p className="text-[13px] placeholder-text">{t.noGroupsYet}</p>}

      {groups.map((group, gi) => {
        const duplicate = duplicates.has(group.name.trim().toLowerCase());
        return (
          <section key={group.key} className="card p-4 flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <button type="button" onClick={() => setGroups(moved(groups, gi, -1))} disabled={gi === 0} className="text-[9px] leading-none disabled:opacity-20" title={t.moveGroupUp}>
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => setGroups(moved(groups, gi, 1))}
                  disabled={gi === groups.length - 1}
                  className="text-[9px] leading-none disabled:opacity-20"
                  title={t.moveGroupDown}
                >
                  ▼
                </button>
              </div>
              <input
                value={group.name}
                onChange={(e) => updateGroup(group.key, { name: e.target.value })}
                placeholder={t.groupNamePlaceholder}
                aria-label={t.groupNamePlaceholder}
                required
                list="quote-saved-categories"
                className={`input flex-1 min-w-0 !text-[15px] font-semibold ${duplicate ? "!border-warning" : ""}`}
              />
              <span className="hidden sm:block text-[13px] tabular-nums placeholder-text shrink-0">{formatCurrency(subtotal(group.items), currency)}</span>
              <button type="button" onClick={() => removeGroup(group)} className="btno !px-3 !py-1.5 text-[9px] shrink-0">
                {t.removeGroup}
              </button>
            </div>
            {duplicate && <p className="text-[11px] text-warning">{t.duplicateGroup}</p>}
            {group.items.length > 0 && columnHeads()}
            {itemRows(group.items, (items) => updateGroup(group.key, { items }))}
            <button
              type="button"
              onClick={() => {
                const item = blankGroupItem();
                updateGroup(group.key, { items: [...group.items, item] });
                setFocusKey(item.key);
              }}
              className="self-start text-[10px] tracking-[0.1em] uppercase placeholder-text hover:text-accent transition-colors"
            >
              + {t.addItem}
            </button>
          </section>
        );
      })}

      {loose.length > 0 && (
        <section className="rounded-2xl border border-dashed border-ink/20 p-4 flex flex-col gap-2.5">
          <div className="heading-label !text-[11px]">{t.ungrouped}</div>
          {columnHeads()}
          {itemRows(loose, setLoose)}
        </section>
      )}

      <datalist id="quote-saved-categories">
        {savedCategories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {/* New group: typed here (this quote only) or one of the saved categories. */}
      <div className="flex flex-col gap-2">
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
            className="input flex-1 min-w-0"
          />
          <button type="button" onClick={() => addGroup(newName)} disabled={!newName.trim()} className="btn shrink-0 disabled:opacity-40">
            + {t.addGroup}
          </button>
        </div>
        {unusedSaved.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] placeholder-text mr-1">{t.savedCategories}:</span>
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
          className="self-start text-[10px] tracking-[0.1em] uppercase placeholder-text hover:text-accent transition-colors"
        >
          + {t.addUngroupedItem}
        </button>
      </div>

      <div className="flex flex-wrap justify-end items-center gap-x-6 gap-y-1 text-[13px]">
        <div>
          <span className="heading-label mr-2">{t.base}</span>
          {formatCurrency(base, currency)}
        </div>
        <div>
          <span className="heading-label mr-2">{t.vat}</span>
          {formatCurrency(vat, currency)}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="heading-label mr-1">{t.toPay}</span>
          <span className="font-semibold text-base">{formatCurrency(base + vat, currency)}</span>
          <span className="tag tag-neutral">{currency}</span>
        </div>
      </div>
    </div>
  );
}
