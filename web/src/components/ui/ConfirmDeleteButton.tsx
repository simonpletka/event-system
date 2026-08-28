"use client";

import { useTransition } from "react";
import { useConfirmDialog } from "./ConfirmDialogProvider";

/**
 * Deliberately NOT a <form action={fn}> + onSubmit-preventDefault gate — that
 * pattern raced in practice (React 19's own form-action dispatch could win
 * against the onSubmit handler's preventDefault(), so the delete fired even
 * when the user cancelled the dialog). The in-app confirm() from
 * ConfirmDialogProvider runs first in a plain onClick, and the action is
 * only ever invoked programmatically after the user approves — there's no
 * submit event for anything to race against.
 */
export function ConfirmDeleteButton({
  action,
  fields,
  confirmMessage,
  label = "Delete",
  pendingLabel,
  className = "btno !border-warning text-warning",
  children,
  title,
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  confirmMessage: string;
  label?: string;
  pendingLabel?: string;
  className?: string;
  /** Icon-only rendering — the button shows this instead of the label text. `label` still drives the confirm dialog's action button. */
  children?: React.ReactNode;
  title?: string;
}) {
  const [pending, startTransition] = useTransition();
  const { confirm } = useConfirmDialog();

  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      title={title}
      aria-label={children ? (title ?? label) : undefined}
      onClick={async () => {
        const ok = await confirm(confirmMessage, { confirmLabel: label });
        if (!ok) return;
        const formData = new FormData();
        for (const [name, value] of Object.entries(fields)) formData.set(name, value);
        startTransition(() => {
          action(formData);
        });
      }}
    >
      {pending ? (pendingLabel ?? "Deleting…") : (children ?? label)}
    </button>
  );
}
