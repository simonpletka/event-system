"use client";

import { useActionState } from "react";
import { createInvoiceAction, type FinanceFormState } from "@/lib/actions/finance";
import { LineItemsFields } from "./LineItemsFields";

const initialState: FinanceFormState = {};

export function InvoiceForm({
  events,
  defaultDueDate,
}: {
  events: { id: string; title: string; companyName: string }[];
  defaultDueDate: string;
}) {
  const [state, formAction, pending] = useActionState(createInvoiceAction, initialState);

  return (
    <form action={formAction} className="max-w-2xl flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="heading-label">Event</span>
        <select name="eventId" required defaultValue="" className="input">
          <option value="" disabled>
            Select an event…
          </option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title} — {e.companyName}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 max-w-xs">
        <span className="heading-label">Due date</span>
        <input name="dueDate" type="date" required defaultValue={defaultDueDate} className="input" />
      </label>

      <LineItemsFields initial={[]} />

      {state.error && <p className="text-sm text-accent">{state.error}</p>}

      <div>
        <button type="submit" disabled={pending} className="btn">
          {pending ? "Creating…" : "Create invoice"}
        </button>
      </div>
    </form>
  );
}
