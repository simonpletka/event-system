"use client";

import { useActionState, useRef, useEffect } from "react";
import { createExpenseAction, updateExpenseAction, type FinanceFormState } from "@/lib/actions/finance";
import { ReceiptInput } from "./ReceiptInput";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import { EventPicker, type PickableEvent } from "@/components/EventPicker";
import { CancelLink } from "@/components/ui/CancelLink";
import type { ExpenseCategory } from "@/generated/prisma/enums";
import { getDictionary, type Locale } from "@/lib/dictionary";

const initialState: FinanceFormState = {};

export type ExpenseFormDefaults = {
  id: string;
  eventId: string | null;
  amount: number;
  date: string;
  paidById: string;
  category: ExpenseCategory;
  note: string;
  receiptPath: string | null;
};

export function ExpenseForm({
  events,
  payers,
  currentUserId,
  defaults,
  locale,
}: {
  events: PickableEvent[];
  payers: { id: string; name: string }[];
  currentUserId: string;
  defaults?: ExpenseFormDefaults;
  locale: Locale;
}) {
  const t = getDictionary(locale);
  const isEdit = Boolean(defaults);
  const action = isEdit ? updateExpenseAction : createExpenseAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const tf = t.finance.expenses.form;

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="max-w-2xl flex flex-col gap-4">
      {isEdit && <input type="hidden" name="id" value={defaults!.id} />}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReceiptInput existingReceiptPath={defaults?.receiptPath} t={t.finance.expenses.receipt} />
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="field-label">{tf.amountLabel}</span>
            <input name="amount" type="number" min={1} required defaultValue={defaults?.amount} className="input" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">{tf.dateOfPaymentLabel}</span>
            <input
              name="date"
              type="date"
              required
              defaultValue={defaults?.date ?? new Date().toISOString().slice(0, 10)}
              className="input"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">{tf.paidByLabel}</span>
            <select name="paidById" defaultValue={defaults?.paidById ?? currentUserId} className="input">
              {payers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.id === currentUserId ? tf.meSuffix : ""}
                </option>
              ))}
            </select>
            <span className="text-[9px] placeholder-text">{tf.cardHoldersHint}</span>
          </label>
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="field-label">{tf.eventLabel}</span>
        <EventPicker
          name="eventId"
          initialEvents={events}
          defaultValue={defaults?.eventId ?? ""}
          extraOption={{ value: "", label: tf.companyOverheadOption }}
          t={t.events.picker}
        />
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{tf.categoryLabel}</span>
          <select name="category" defaultValue={defaults?.category ?? "GENERIC"} className="input">
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t.expenseCategories[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{tf.noteLabel}</span>
          <input name="note" placeholder={tf.notePlaceholder} defaultValue={defaults?.note} className="input" />
          <span className="text-[9px] placeholder-text">{tf.approvalHint}</span>
        </label>
      </div>

      {state.error && <p className="text-sm text-accent">{state.error}</p>}
      {state.success && <p className="text-sm text-positive font-bold">{tf.savedMsg}</p>}

      <div className="flex gap-2 pt-3 border-t-2 border-ink">
        <button type="submit" disabled={pending} className="btn">
          {isEdit ? tf.saveChanges : tf.saveExpense}
        </button>
        {!isEdit && (
          <button type="submit" name="again" value="1" disabled={pending} className="btno">
            {tf.saveAndAddAnother}
          </button>
        )}
        <CancelLink href="/finance/expenses" label={t.common.cancel} />
      </div>
    </form>
  );
}
