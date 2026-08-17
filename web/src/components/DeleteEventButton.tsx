"use client";

import { useTransition } from "react";

// See ConfirmDeleteButton.tsx for why this is onClick + a direct action call
// rather than <form action> + onSubmit-preventDefault (that pattern raced).
export function DeleteEventButton({
  action,
  eventId,
  eventTitle,
  expenseCount,
}: {
  action: (formData: FormData) => void;
  eventId: string;
  eventTitle: string;
  expenseCount: number;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="btno !border-accent text-accent"
      onClick={() => {
        if (expenseCount > 0) {
          alert(
            `"${eventTitle}" can't be deleted — it has ${expenseCount} expense${expenseCount === 1 ? "" : "s"} recorded against it. Remove or reassign ${expenseCount === 1 ? "it" : "them"} first, then try again.`
          );
          return;
        }
        if (!confirm(`Delete "${eventTitle}"? This permanently removes its milestones, time entries, quotes and invoices. This can't be undone.`)) {
          return;
        }
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
