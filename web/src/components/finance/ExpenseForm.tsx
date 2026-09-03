"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { createExpenseAction, updateExpenseAction, type FinanceFormState } from "@/lib/actions/finance";
import { ReceiptInput } from "./ReceiptInput";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import { ProjectPicker, type PickableProject } from "@/components/ProjectPicker";
import { CancelLink } from "@/components/ui/CancelLink";
import { DateTimeField } from "@/components/ui/DateTimeField";
import { isoDate } from "@/lib/calendar";
import type { ExpenseCategory } from "@/generated/prisma/enums";
import { getDictionary, type Locale } from "@/lib/dictionary";

const initialState: FinanceFormState = {};

export type ExpenseFormDefaults = {
  id: string;
  projectId: string | null;
  amount: number;
  vatRate: number;
  vatAmount: number;
  date: string;
  paidById: string;
  category: ExpenseCategory;
  note: string;
  receiptPath: string | null;
};

const VAT_RATES = [21, 12, 0];

/** Deductible VAT contained in a gross amount at a given rate (0 → 0). */
function vatFromGross(gross: number, rate: number) {
  if (!gross || rate <= 0) return 0;
  return Math.round(gross - gross / (1 + rate / 100));
}

export function ExpenseForm({
  events,
  payers,
  currentUserId,
  defaults,
  locale,
}: {
  events: PickableProject[];
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

  // Amount / VAT rate / deductible VAT are uncontrolled: the deductible figure
  // auto-derives from the gross amount and rate until the accountant edits it
  // by hand, so we drive it imperatively rather than through React state.
  const amountRef = useRef<HTMLInputElement>(null);
  const vatRateRef = useRef<HTMLSelectElement>(null);
  const vatAmountRef = useRef<HTMLInputElement>(null);
  const vatTouched = useRef(Boolean(defaults && defaults.vatAmount !== vatFromGross(defaults.amount, defaults.vatRate)));

  function syncVat() {
    if (vatTouched.current || !vatAmountRef.current) return;
    const gross = Math.round(Number(amountRef.current?.value) || 0);
    const rate = Number(vatRateRef.current?.value) || 0;
    vatAmountRef.current.value = String(vatFromGross(gross, rate) || "");
  }

  // On "save and add another" the action returns { success } and the form
  // clears — bump a key so the uncontrolled fields remount at their defaults.
  const [resetKey, setResetKey] = useState(0);
  const [prevSuccess, setPrevSuccess] = useState(false);
  if (state.success !== prevSuccess) {
    setPrevSuccess(Boolean(state.success));
    if (state.success) setResetKey((k) => k + 1);
  }

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      vatTouched.current = false;
    }
  }, [state.success]);

  const onAmountOrRate = () => syncVat();

  return (
    <form ref={formRef} action={formAction} className="w-full flex flex-col gap-4">
      {isEdit && <input type="hidden" name="id" value={defaults!.id} />}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReceiptInput existingReceiptPath={defaults?.receiptPath} t={t.finance.expenses.receipt} />
        <div className="flex flex-col gap-3">
          <div key={resetKey} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="field-label">{tf.amountLabel}</span>
              <input
                ref={amountRef}
                name="amount"
                type="number"
                min={1}
                required
                defaultValue={defaults?.amount || ""}
                onChange={onAmountOrRate}
                className="input"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="field-label">{tf.vatRateLabel}</span>
                <select
                  ref={vatRateRef}
                  name="vatRate"
                  defaultValue={defaults?.vatRate ?? 21}
                  onChange={onAmountOrRate}
                  className="input"
                >
                  {VAT_RATES.map((r) => (
                    <option key={r} value={r}>
                      {r}%
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="field-label">{tf.deductibleVatLabel}</span>
                <input
                  ref={vatAmountRef}
                  name="vatAmount"
                  type="number"
                  min={0}
                  defaultValue={defaults?.vatAmount || ""}
                  onChange={() => {
                    vatTouched.current = true;
                  }}
                  className="input"
                />
              </label>
            </div>
            <span className="text-[9px] placeholder-text -mt-1">{tf.deductibleVatHint}</span>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">{tf.dateOfPaymentLabel}</span>
            <DateTimeField name="date" required defaultValue={defaults?.date ?? isoDate(new Date())} />
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
        <span className="field-label">{tf.projectLabel}</span>
        <ProjectPicker
          name="projectId"
          initialEvents={events}
          defaultValue={defaults?.projectId ?? ""}
          extraOption={{ value: "", label: tf.companyOverheadOption }}
          t={t.projects.picker}
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
