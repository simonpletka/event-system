"use client";

import { useActionState, useState } from "react";
import { createCategoryAction, renameCategoryAction, deleteCategoryAction, type CategoryFormState } from "@/lib/actions/categories";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { getDictionary, type Dictionary, type Locale } from "@/lib/dictionary";

export type CategoryRow = { id: string; name: string };

type T = Dictionary["settings"]["categories"];

const initialState: CategoryFormState = {};

export function CategoriesTab({ categories, locale }: { categories: CategoryRow[]; locale: Locale }) {
  const t = getDictionary(locale).settings.categories;
  return (
    <div>
      <p className="text-[10px] placeholder-text mb-3 max-w-prose">{t.helperText}</p>

      <div className="card p-3.5">
        <div className="grid grid-cols-[1fr_auto] gap-2.5 border-b border-ink/14 pb-1.5 [&_.heading-label]:font-bold [&_.heading-label]:!text-[9px]">
          <span className="heading-label">{t.colName}</span>
          <span className="heading-label"></span>
        </div>

        {categories.length === 0 && <p className="text-sm placeholder-text mt-3">{t.noCategoriesYet}</p>}
        {categories.map((c) => (
          <CategoryRowItem key={c.id} category={c} t={t} />
        ))}

        <AddCategoryForm t={t} />
      </div>
    </div>
  );
}

function CategoryRowItem({ category, t }: { category: CategoryRow; t: T }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);

  if (editing) {
    return (
      <form
        action={renameCategoryAction}
        className="grid grid-cols-[1fr_auto] gap-2.5 items-center py-2.5 border-b border-ink/13"
        onSubmit={() => setEditing(false)}
      >
        <input type="hidden" name="id" value={category.id} />
        <input name="name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus className="input" />
        <div className="flex gap-2 text-[9px] tracking-[0.1em] uppercase">
          <button type="submit" className="placeholder-text hover:text-ink">
            {t.save}
          </button>
          <button type="button" onClick={() => { setName(category.name); setEditing(false); }} className="placeholder-text hover:text-ink">
            {t.cancel}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="grid grid-cols-[1fr_auto] gap-2.5 items-center py-3 border-b border-ink/13 text-[15px]">
      <div>{category.name}</div>
      <div className="flex gap-2 text-[9px] tracking-[0.1em] uppercase">
        <button type="button" onClick={() => setEditing(true)} className="placeholder-text hover:text-ink">
          {t.rename}
        </button>
        <ConfirmDeleteButton
          action={deleteCategoryAction}
          fields={{ id: category.id }}
          label={t.delete}
          confirmMessage={t.confirmDelete(category.name)}
          className="placeholder-text hover:text-warning"
        />
      </div>
    </div>
  );
}

function AddCategoryForm({ t }: { t: T }) {
  const [state, formAction, pending] = useActionState(createCategoryAction, initialState);

  return (
    <form action={formAction} className="flex gap-2 items-start mt-2.5 max-w-sm">
      <input name="name" placeholder={t.newCategoryPlaceholder} required className="input flex-1" />
      <button type="submit" disabled={pending} className="btno text-[9px]">
        {pending ? t.adding : t.add}
      </button>
      {state.error && <p className="text-[11px] text-warning">{state.error}</p>}
    </form>
  );
}
