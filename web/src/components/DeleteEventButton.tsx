"use client";

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
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (expenseCount > 0) {
          e.preventDefault();
          alert(
            `"${eventTitle}" can't be deleted — it has ${expenseCount} expense${expenseCount === 1 ? "" : "s"} recorded against it. Remove or reassign ${expenseCount === 1 ? "it" : "them"} first, then try again.`
          );
          return;
        }
        if (!confirm(`Delete "${eventTitle}"? This permanently removes its milestones, time entries, quotes and invoices. This can't be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={eventId} />
      <button type="submit" className="btno !border-accent text-accent">
        Delete event
      </button>
    </form>
  );
}
