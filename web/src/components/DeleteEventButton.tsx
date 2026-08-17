"use client";

import { useTransition } from "react";
import { useConfirmDialog } from "@/components/ui/ConfirmDialogProvider";

// See ConfirmDeleteButton.tsx for why this is onClick + a direct action call
// rather than <form action> + onSubmit-preventDefault (that pattern raced).
export function DeleteEventButton({
  action,
  eventId,
  eventTitle,
  expenseCount,
  invoiceCount,
}: {
  action: (formData: FormData) => void;
  eventId: string;
  eventTitle: string;
  expenseCount: number;
  invoiceCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const { confirm, notify } = useConfirmDialog();

  return (
    <button
      type="button"
      disabled={pending}
      className="btno !border-accent text-accent"
      onClick={async () => {
        if (expenseCount > 0 || invoiceCount > 0) {
          const parts: string[] = [];
          if (invoiceCount > 0) parts.push(`${invoiceCount} invoice${invoiceCount === 1 ? "" : "s"}`);
          if (expenseCount > 0) parts.push(`${expenseCount} expense${expenseCount === 1 ? "" : "s"}`);
          const pronoun = expenseCount + invoiceCount === 1 ? "it" : "them";
          await notify(
            `"${eventTitle}" can't be deleted — it has ${parts.join(" and ")} recorded against it. Remove or reassign ${pronoun} first, then try again.`,
            { title: "Can't delete this event" }
          );
          return;
        }
        const ok = await confirm(
          `Delete "${eventTitle}"? This permanently removes its milestones, time entries, quotes and invoices. This can't be undone.`,
          { confirmLabel: "Delete event" }
        );
        if (!ok) return;
        const formData = new FormData();
        formData.set("id", eventId);
        startTransition(() => {
          action(formData);
        });
      }}
    >
      {pending ? "Deleting…" : "Delete event"}
    </button>
  );
}
