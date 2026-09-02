"use client";

import { useTransition } from "react";
import { useConfirmDialog } from "@/components/ui/ConfirmDialogProvider";
import { getDictionary, type Locale } from "@/lib/dictionary";

// See ConfirmDeleteButton.tsx for why this is onClick + a direct action call
// rather than <form action> + onSubmit-preventDefault (that pattern raced).
export function DeleteProjectButton({
  action,
  projectId,
  projectTitle,
  expenseCount,
  invoiceCount,
  locale,
}: {
  action: (formData: FormData) => void;
  projectId: string;
  projectTitle: string;
  expenseCount: number;
  invoiceCount: number;
  locale: Locale;
}) {
  const t = getDictionary(locale).projects;
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
          await notify(t.cantDeleteMsg(projectTitle, parts.join(" and "), pronoun), { title: t.cantDeleteTitle });
          return;
        }
        const ok = await confirm(t.confirmDeleteProject(projectTitle), { confirmLabel: t.deleteProject });
        if (!ok) return;
        const formData = new FormData();
        formData.set("id", projectId);
        startTransition(() => {
          action(formData);
        });
      }}
    >
      {pending ? t.deleting : t.deleteProject}
    </button>
  );
}
