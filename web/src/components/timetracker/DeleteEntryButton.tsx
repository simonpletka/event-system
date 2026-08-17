"use client";

import { useTransition } from "react";
import { deleteTimeEntryAction } from "@/lib/actions/timetracker";

// See ConfirmDeleteButton.tsx for why this is onClick + a direct action call
// rather than <form action> + onSubmit-preventDefault (that pattern raced).
export function DeleteEntryButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="placeholder-text hover:text-accent"
      onClick={() => {
        if (!confirm("Delete this time entry? This can't be undone.")) return;
        const formData = new FormData();
        formData.set("id", id);
        startTransition(() => {
          deleteTimeEntryAction(formData);
        });
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
