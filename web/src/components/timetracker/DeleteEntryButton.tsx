"use client";

import { deleteTimeEntryAction } from "@/lib/actions/timetracker";

export function DeleteEntryButton({ id }: { id: string }) {
  return (
    <form
      action={deleteTimeEntryAction}
      onSubmit={(e) => {
        if (!confirm("Delete this time entry? This can't be undone.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="placeholder-text hover:text-accent">
        Delete
      </button>
    </form>
  );
}
