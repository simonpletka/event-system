"use client";

import { useActionState, useRef, useEffect } from "react";
import { createExpenseAction, updateExpenseAction, type FinanceFormState } from "@/lib/actions/finance";
import { ReceiptInput } from "./ReceiptInput";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL } from "@/lib/expense-categories";
import { EventPicker, type PickableEvent } from "@/components/EventPicker";
import { CancelLink } from "@/components/ui/CancelLink";
import type { ExpenseCategory } from "@/generated/prisma/enums";

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
}: {
  events: PickableEvent[];
  payers: { id: string; name: string }[];
  currentUserId: string;
  defaults?: ExpenseFormDefaults;
}) {
  const isEdit = Boolean(defaults);
  const action = isEdit ? updateExpenseAction : createExpenseAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="max-w-2xl flex flex-col gap-4">
      {isEdit && <input type="hidden" name="id" value={defaults!.id} />}
      <div className="grid grid-cols-2 gap-4">
        <ReceiptInput existingReceiptPath={defaults?.receiptPath} />
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="heading-label">Amount (CZK)</span>
            <input name="amount" type="number" min={1} required defaultValue={defaults?.amount} className="input" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="heading-label">Date of payment</span>
            <input
              name="date"
              type="date"
              required
              defaultValue={defaults?.date ?? new Date().toISOString().slice(0, 10)}
              className="input"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="heading-label">Paid by</span>
            <select name="paidById" defaultValue={defaults?.paidById ?? currentUserId} className="input">
              {payers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.id === currentUserId ? " (me)" : ""}
                </option>
              ))}
            </select>
            <span className="text-[9px] placeholder-text">Only members flagged as card holders are offered.</span>
          </label>
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="heading-label">Event</span>
        <EventPicker
          name="eventId"
          initialEvents={events}
          defaultValue={defaults?.eventId ?? ""}
          extraOption={{ value: "", label: "Company overhead — not tied to an event" }}
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">Category</span>
          <select name="category" defaultValue={defaults?.category ?? "GENERIC"} className="input">
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EXPENSE_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">Note</span>
          <input name="note" placeholder="e.g. two-way radios rental" defaultValue={defaults?.note} className="input" />
          <span className="text-[9px] placeholder-text">Needs approval by a manager — not enforced yet, expenses count immediately.</span>
        </label>
      </div>

      {state.error && <p className="text-sm text-accent">{state.error}</p>}
      {state.success && <p className="text-sm">Expense saved.</p>}

      <div className="flex gap-2 pt-3 border-t-2 border-ink">
        <button type="submit" disabled={pending} className="btn">
          {isEdit ? "Save changes" : "Save expense"}
        </button>
        {!isEdit && (
          <button type="submit" name="again" value="1" disabled={pending} className="btno">
            Save and add another
          </button>
        )}
        <CancelLink href="/finance/expenses" />
      </div>
    </form>
  );
}
