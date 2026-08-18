"use client";

import { useTransition } from "react";
import { deleteTimeEntryAction } from "@/lib/actions/timetracker";
import { useConfirmDialog } from "@/components/ui/ConfirmDialogProvider";

// See ConfirmDeleteButton.tsx for why this is onClick + a direct action call
// rather than <form action> + onSubmit-preventDefault (that pattern raced).
export function DeleteEntryButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const { confirm } = useConfirmDialog();

  return (
    <button
      type="button"
      disabled={pending}
      className="placeholder-text hover:text-warning"
      onClick={async () => {
        const ok = await confirm("Delete this time entry? This can't be undone.", { confirmLabel: "Delete" });
        if (!ok) return;
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
