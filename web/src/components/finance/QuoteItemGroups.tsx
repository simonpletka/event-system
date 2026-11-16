"use client";

import { useRef, useState } from "react";
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
import { TrashIcon } from "@/components/ui/icons";

type T = Dictionary["finance"]["lineItems"];

// Column heads and item rows share one grid. Phone: description across the
// row, then qty · unit price · VAT · remove (no line-total column).
const ROW_GRID =
  "grid grid-cols-[repeat(3,minmax(0,1fr))_28px] md:grid-cols-[18px_minmax(0,1fr)_60px_108px_60px_96px_28px] gap-x-2 gap-y-1.5 items-center";
const HEAD = "text-[11px] font-bold uppercase tracking-[0.1em] text-ink/60";
const ICON_BTN =
  "grid place-items-center w-7 h-7 rounded-full text-ink/45 hover:text-warning hover:bg-warning/10 transition-colors";
const LINK_BTN = "text-[13px] font-semibold text-ink/70 hover:text-accent transition-colors";
const TEXT_INPUT = "input !text-[14px]";
const NUM_INPUT = "input !text-[14px] text-right tabular-nums";

function moved<X>(list: X[], i: number, dir: -1 | 1): X[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/**
 * Quote line items edited inside named groups (the category headings on the
 * quote). Each group is its own card (orange left edge once it has items)
 * ending in a quick-add line; an overview on the right lists every group with
 * its subtotal plus the totals, and jumps to a group on click. A group is
 * created here: type a new name (used on this quote only) or pick one of the
 * saved categories from Settings. Items take their group's name as category.
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
  // Text typed into each group's quick-add line, by group key ("" key = ungrouped).
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const newGroupRef = useRef<HTMLInputElement>(null);

  const flat = itemsFromGroups(groups, loose);
  const base = flat.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const vat = flat.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0);
  const duplicates = duplicateGroupNames(groups);
  const usedNames = new Set(groups.map((g) => g.name.trim().toLowerCase()));
  const unusedSaved = savedCategories.filter((c) => !usedNames.has(c.trim().toLowerCase()));

  const setGroups = (next: ItemGroup[]) => onChange(next, loose);
  const setLoose = (next: GroupItem[]) => onChange(groups, next);
  const updateGroup = (key: string, patch: Partial<ItemGroup>) => setGroups(groups.map((g) => (g.key === key ? { ...g, ...patch } : g)));
  const subtotal = (items: GroupItem[]) => items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const money = (n: number) => formatCurrency(n, currency);

  function addGroup(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setGroups([...groups, { key: newKey(), name: trimmed, items: [] }]);
    setNewName("");
  }

  async function removeGroup(group: ItemGroup) {
    const filled = group.items.filter((i) => i.description.trim()).length;
    if (filled > 0 && !(await confirm(t.confirmRemoveGroup(group.name || "—", filled), { confirmLabel: t.removeGroup }))) return;
    setGroups(groups.filter((g) => g.key !== group.key));
  }

  function jumpTo(key: string) {
    document.getElementById(`quote-group-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function itemRows(items: GroupItem[], setItems: (next: GroupItem[]) => void) {
    const update = (key: string, patch: Partial<GroupItem>) => setItems(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));
    return items.map((item, i) => (
      <div key={item.key} className={ROW_GRID}>
        <div className="hidden md:flex flex-col items-center text-ink/50">
          <button type="button" onClick={() => setItems(moved(items, i, -1))} disabled={i === 0} className="text-[9px] leading-[11px] hover:text-ink disabled:opacity-20" title={t.moveUp}>
            ▲
          </button>
          <button
            type="button"
            onClick={() => setItems(moved(items, i, 1))}
            disabled={i === items.length - 1}
            className="text-[9px] leading-[11px] hover:text-ink disabled:opacity-20"
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
          className={`${TEXT_INPUT} col-span-4 md:col-span-1`}
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
        <span className="hidden md:block text-right text-[14px] tabular-nums text-ink/85">{money(item.quantity * item.unitPrice)}</span>
        <button type="button" onClick={() => setItems(items.filter((x) => x.key !== item.key))} title={t.removeBtn} aria-label={t.removeBtn} className={ICON_BTN}>
          <TrashIcon size={14} />
        </button>
      </div>
    ));
  }

  function columnHeads() {
    return (
      <div className={`${ROW_GRID} !hidden md:!grid`}>
        <span />
        <span className={HEAD}>{t.colDescription}</span>
        <span className={`${HEAD} text-right`}>{t.colQty}</span>
        <span className={`${HEAD} text-right`}>{t.colUnitPrice}</span>
        <span className={`${HEAD} text-right`}>{t.colVat}</span>
        <span className={`${HEAD} text-right`}>{t.colTotal}</span>
        <span />
      </div>
    );
  }

  /** "Type an item and press Enter" — adds an item with that description and stays ready for the next one. */
  function quickAdd(draftKey: string, add: (item: GroupItem) => void) {
    const value = drafts[draftKey] ?? "";
    const commit = () => {
      const text = value.trim();
      if (!text) return;
      add({ ...blankGroupItem(), description: text });
      setDrafts({ ...drafts, [draftKey]: "" });
    };
    return (
      <div className="flex gap-2 md:pl-[26px]">
        <input
          value={value}
          onChange={(e) => setDrafts({ ...drafts, [draftKey]: e.target.value })}
          onKeyDown={(e) => {
            // Enter adds the item instead of submitting the whole quote.
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          placeholder={t.quickAddPlaceholder}
          aria-label={t.addItem}
          className={`${TEXT_INPUT} flex-1 min-w-0`}
        />
        <button type="button" onClick={commit} disabled={!value.trim()} className="btno shrink-0 disabled:opacity-40">
          + {t.addItem}
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_240px] gap-5 items-start">
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

      <div className="flex flex-col gap-3 min-w-0">
        <p className="text-[13px] text-ink/70">{t.groupsHint}</p>

        {groups.length === 0 && loose.length === 0 && <p className="text-[14px] text-ink/70">{t.noGroupsYet}</p>}

        {groups.map((group, gi) => {
          const duplicate = duplicates.has(group.name.trim().toLowerCase());
          const empty = group.items.length === 0;
          return (
            <section
              key={group.key}
              id={`quote-group-${group.key}`}
              className={`scroll-mt-28 rounded-[14px] border border-ink/12 border-l-[3px] bg-ink/[0.03] px-4 py-3.5 flex flex-col gap-2 ${
                empty ? "border-l-ink/25" : "border-l-accent"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center w-[18px] text-ink/50">
                  <button type="button" onClick={() => setGroups(moved(groups, gi, -1))} disabled={gi === 0} className="text-[9px] leading-[11px] hover:text-ink disabled:opacity-20" title={t.moveGroupUp}>
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroups(moved(groups, gi, 1))}
                    disabled={gi === groups.length - 1}
                    className="text-[9px] leading-[11px] hover:text-ink disabled:opacity-20"
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
                  className={`flex-1 min-w-0 bg-transparent rounded-lg border px-2 py-1 text-[16px] font-bold text-ink outline-none transition-colors placeholder:text-ink/40 hover:border-ink/25 focus:border-ink ${
                    duplicate ? "border-warning" : "border-transparent"
                  }`}
                />
                {empty ? (
                  <span className="hidden sm:block text-[13px] text-ink/55 shrink-0">{t.emptyGroupShort}</span>
                ) : (
                  <span className="text-[15px] font-bold tabular-nums shrink-0">{money(subtotal(group.items))}</span>
                )}
                <button type="button" onClick={() => removeGroup(group)} title={t.removeGroup} aria-label={t.removeGroup} className={ICON_BTN}>
                  <TrashIcon size={14} />
                </button>
              </div>
              {duplicate && <p className="text-[13px] text-warning md:pl-[26px]">{t.duplicateGroup}</p>}
              {!empty && columnHeads()}
              {itemRows(group.items, (items) => updateGroup(group.key, { items }))}
              {quickAdd(group.key, (item) => updateGroup(group.key, { items: [...group.items, item] }))}
            </section>
          );
        })}

        {loose.length > 0 && (
          <section
            id="quote-group-loose"
            className="scroll-mt-28 rounded-[14px] border border-dashed border-ink/25 px-4 py-3.5 flex flex-col gap-2"
          >
            <div className="flex items-center gap-2 md:pl-[26px]">
              <span className="flex-1 text-[16px] font-bold text-ink/75">{t.ungrouped}</span>
              <span className="text-[15px] font-bold tabular-nums">{money(subtotal(loose))}</span>
              <span className="w-7" />
            </div>
            {columnHeads()}
            {itemRows(loose, setLoose)}
            {quickAdd("", (item) => setLoose([...loose, item]))}
          </section>
        )}

        <datalist id="quote-saved-categories">
          {savedCategories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        {/* New group: typed here (this quote only) or one of the saved categories. */}
        <div className="flex flex-col gap-2.5 mt-1">
          <div className="flex gap-2">
            <input
              ref={newGroupRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addGroup(newName);
                }
              }}
              placeholder={t.newGroupPlaceholder}
              aria-label={t.newGroupPlaceholder}
              className={`${TEXT_INPUT} flex-1 min-w-0`}
            />
            <button type="button" onClick={() => addGroup(newName)} disabled={!newName.trim()} className="btno shrink-0 disabled:opacity-40">
              + {t.addGroup}
            </button>
          </div>
          {unusedSaved.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[13px] text-ink/70 mr-1">{t.savedCategories}:</span>
              {unusedSaved.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => addGroup(c)}
                  className="rounded-full border border-ink/25 px-3 py-1 text-[13px] text-ink/85 hover:border-accent hover:text-ink transition-colors"
                >
                  + {c}
                </button>
              ))}
            </div>
          )}
          {loose.length === 0 && (
            <button
              type="button"
              onClick={() => {
                const item = blankGroupItem();
                setLoose([item]);
                setFocusKey(item.key);
              }}
              className={`self-start ${LINK_BTN}`}
            >
              + {t.addUngroupedItem}
            </button>
          )}
        </div>
      </div>

      {/* Overview: every group with its subtotal, then the totals. Sticky beside the groups on desktop; on phones only the totals, below. */}
      <aside className="md:sticky md:top-28 rounded-[14px] border border-ink/12 bg-ink/[0.03] p-2.5 flex flex-col">
        <div className="hidden md:flex flex-col">
          <div className={`${HEAD} px-2.5 pt-1 pb-2`}>{t.overview}</div>
          {groups.map((g) => {
            const empty = g.items.length === 0;
            return (
              <button
                key={g.key}
                type="button"
                onClick={() => jumpTo(g.key)}
                className="flex justify-between gap-3 rounded-[10px] px-2.5 py-2 text-left text-[14px] hover:bg-accent/15 transition-colors"
              >
                <span className={`truncate ${empty ? "text-ink/60" : "text-ink"}`}>{g.name || "—"}</span>
                <span className={`tabular-nums shrink-0 ${empty ? "text-ink/45" : "text-ink/90"}`}>{empty ? "—" : money(subtotal(g.items))}</span>
              </button>
            );
          })}
          {loose.length > 0 && (
            <button
              type="button"
              onClick={() => jumpTo("loose")}
              className="flex justify-between gap-3 rounded-[10px] px-2.5 py-2 text-left text-[14px] hover:bg-accent/15 transition-colors"
            >
              <span className="truncate text-ink/75">{t.ungrouped}</span>
              <span className="tabular-nums shrink-0 text-ink/90">{money(subtotal(loose))}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              newGroupRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              newGroupRef.current?.focus({ preventScroll: true });
            }}
            className="rounded-[10px] px-2.5 py-2 text-left text-[14px] text-ink/60 hover:text-accent transition-colors"
          >
            + {t.addGroup}
          </button>
        </div>
        <div className="md:border-t md:border-ink/12 md:mt-1.5 px-2.5 pt-2.5 pb-1 flex flex-col gap-1.5">
          <div className="flex justify-between text-[14px]">
            <span className="text-ink/70">{t.base}</span>
            <span className="tabular-nums">{money(base)}</span>
          </div>
          <div className="flex justify-between text-[14px]">
            <span className="text-ink/70">{t.vat}</span>
            <span className="tabular-nums">{money(vat)}</span>
          </div>
          <div className="flex justify-between items-baseline pt-1.5">
            <span className="text-[14px] font-bold">{t.toPay}</span>
            <span className="text-[20px] font-bold tabular-nums">{money(base + vat)}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
