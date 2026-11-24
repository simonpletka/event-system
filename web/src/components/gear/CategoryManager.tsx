"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { getDictionary, type Locale } from "@/lib/dictionary";
import { createGearCategoryAction, deleteGearCategoryAction, renameGearCategoryAction, type GearFormState } from "@/lib/actions/gear";
import type { GearDictionary } from "@/lib/dictionary-gear";

/** Error codes from the gear actions, as text. */
export function gearError(t: GearDictionary, code: string | undefined) {
  if (!code) return null;
  const value = (t as Record<string, unknown>)[code];
  return typeof value === "string" ? value : t.errorGeneric;
}

function CategoryRow({ category, t }: { category: { id: string; name: string; typeCount: number }; t: GearDictionary }) {
  const [state, action, pending] = useActionState<GearFormState, FormData>(renameGearCategoryAction, {});
  const [name, setName] = useState(category.name);
  return (
    <li className="py-2 border-t border-ink/8 first:border-t-0">
      <form action={action} className="flex items-center gap-2">
        <input type="hidden" name="id" value={category.id} />
        <input name="name" value={name} onChange={(e) => setName(e.target.value)} aria-label={t.categoryName} className="input flex-1 min-w-0" />
        {name.trim() !== category.name && (
          <button type="submit" disabled={pending} className="btno !text-[10px]">
            {t.rename}
          </button>
        )}
        {category.typeCount === 0 ? (
          <ConfirmDeleteButton
            action={deleteGearCategoryAction}
            fields={{ id: category.id }}
            confirmMessage={t.deleteCategoryConfirm(category.name)}
            label={t.remove}
            className="btno !text-[10px] !border-warning text-warning"
          />
        ) : (
          <span className="text-[12px] placeholder-text tabular-nums w-[52px] text-right" title={t.categoryInUse}>
            {t.typesCount(category.typeCount)}
          </span>
        )}
      </form>
      {state.error && <p className="text-[12px] text-warning mt-1">{gearError(t, state.error)}</p>}
    </li>
  );
}

export function CategoryManager({
  categories,
  locale,
  onClose,
}: {
  categories: { id: string; name: string; typeCount: number }[];
  locale: Locale;
  onClose: () => void;
}) {
  const t = getDictionary(locale).gear;
  const [state, action, pending] = useActionState<GearFormState, FormData>(createGearCategoryAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <Modal title={t.manageCategories} onClose={onClose} closeLabel={getDictionary(locale).common.close}>
      <ul className="mb-4">
        {categories.map((c) => (
          <CategoryRow key={`${c.id}:${c.name}`} category={c} t={t} />
        ))}
      </ul>
      <form ref={formRef} action={action} className="flex gap-2">
        <input name="name" placeholder={t.categoryName} aria-label={t.categoryName} className="input flex-1 min-w-0" required />
        <button type="submit" disabled={pending} className="btn">
          {t.add}
        </button>
      </form>
      {state.error && <p className="text-[12px] text-warning mt-2">{gearError(t, state.error)}</p>}
    </Modal>
  );
}
