"use client";

import { useTransition } from "react";
import { useConfirmDialog } from "@/components/ui/ConfirmDialogProvider";
import { getDictionary, type Locale } from "@/lib/dictionary";

// See ConfirmDeleteButton.tsx for why this is onClick + a direct action call
// rather than <form action> + onSubmit-preventDefault (that pattern raced).
export function DeleteEventButton({
  action,
  eventId,
  eventTitle,
  expenseCount,
  invoiceCount,
  locale,
}: {
  action: (formData: FormData) => void;
  eventId: string;
  eventTitle: string;
  expenseCount: number;
  invoiceCount: number;
  locale: Locale;
}) {
  const t = getDictionary(locale).events;
  const [pending, startTransition] = useTransition();
  const { confirm, notify } = useConfirmDialog();

  return (
    <button
      type="button"
      disabled={pending}
      className="btno !border-warning text-warning"
      onClick={async () => {
        if (expenseCount > 0 || invoiceCount > 0) {
          const parts: string[] = [];
          if (invoiceCount > 0) parts.push(t.invoicesFragment(invoiceCount));
          if (expenseCount > 0) parts.push(t.expensesFragment(expenseCount));
          const pronoun = expenseCount + invoiceCount === 1 ? "it" : "them";
          // "and" stays untranslated here — no dictionary key for this one conjunction word; see fork report.
          await notify(t.cantDeleteMsg(eventTitle, parts.join(" and "), pronoun), { title: t.cantDeleteTitle });
          return;
        }
        const ok = await confirm(t.confirmDeleteEvent(eventTitle), { confirmLabel: t.deleteEvent });
        if (!ok) return;
        const formData = new FormData();
        formData.set("id", eventId);
        startTransition(() => {
          action(formData);
        });
      }}
    >
      {pending ? t.deleting : t.deleteEvent}
    </button>
  );
}
