"use client";

import { useActionState, useState } from "react";
import { createCategoryAction, renameCategoryAction, deleteCategoryAction, type CategoryFormState } from "@/lib/actions/categories";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";

export type CategoryRow = { id: string; name: string };

const initialState: CategoryFormState = {};

export function CategoriesTab({ categories }: { categories: CategoryRow[] }) {
  return (
    <div>
      <p className="text-[10px] placeholder-text mb-3 max-w-prose">
        Default categories offered when tagging a quote or invoice line item — a quote can still introduce a
        one-off category name of its own that never gets added here. A category with no items on a given
        document simply doesn&apos;t show up in its PDF.
      </p>

      <div className="grid grid-cols-[1fr_auto] gap-2.5 border-b-2 border-ink pb-1.5">
        <span className="heading-label">Name</span>
        <span className="heading-label"></span>
      </div>

      {categories.length === 0 && <p className="text-sm placeholder-text mt-3">No categories yet.</p>}
      {categories.map((c) => (
        <CategoryRowItem key={c.id} category={c} />
      ))}

      <AddCategoryForm />
    </div>
  );
}

function CategoryRowItem({ category }: { category: CategoryRow }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);

  if (editing) {
    return (
      <form
        action={renameCategoryAction}
        className="grid grid-cols-[1fr_auto] gap-2.5 items-center py-2 border-b border-ink/13"
        onSubmit={() => setEditing(false)}
      >
        <input type="hidden" name="id" value={category.id} />
        <input name="name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus className="input" />
        <div className="flex gap-2 text-[9px] tracking-[0.1em] uppercase">
          <button type="submit" className="placeholder-text hover:text-ink">
            Save
          </button>
          <button type="button" onClick={() => { setName(category.name); setEditing(false); }} className="placeholder-text hover:text-ink">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="grid grid-cols-[1fr_auto] gap-2.5 items-center py-2.5 border-b border-ink/13 text-[13px]">
      <div>{category.name}</div>
      <div className="flex gap-2 text-[9px] tracking-[0.1em] uppercase">
        <button type="button" onClick={() => setEditing(true)} className="placeholder-text hover:text-ink">
          Rename
        </button>
        <ConfirmDeleteButton
          action={deleteCategoryAction}
          fields={{ id: category.id }}
          label="Delete"
          confirmMessage={`Delete the category "${category.name}"? Items already tagged with it keep the name as free text.`}
          className="placeholder-text hover:text-warning"
        />
      </div>
    </div>
  );
}

function AddCategoryForm() {
  const [state, formAction, pending] = useActionState(createCategoryAction, initialState);

  return (
    <form action={formAction} className="flex gap-2 items-start mt-2.5 max-w-sm">
      <input name="name" placeholder="New category name" required className="input flex-1" />
      <button type="submit" disabled={pending} className="btno text-[9px]">
        {pending ? "Adding…" : "Add"}
      </button>
      {state.error && <p className="text-[11px] text-warning">{state.error}</p>}
    </form>
  );
}
