"use client";

import { useActionState } from "react";
import { createQuoteAction, updateQuoteAction, type FinanceFormState } from "@/lib/actions/finance";
import { toDateTimeLocal } from "@/lib/format";
import { LineItemsFields, type LineItem } from "./LineItemsFields";
import type { QuoteStatus } from "@/generated/prisma/enums";

const initialState: FinanceFormState = {};

export function QuoteForm({
  events,
  defaults,
}: {
  events: { id: string; title: string; companyName: string }[];
  defaults?: { id: string; eventId: string; status: QuoteStatus; validUntil: Date; items: LineItem[] };
}) {
  const isEdit = Boolean(defaults);
  const action = isEdit ? updateQuoteAction : createQuoteAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="max-w-2xl flex flex-col gap-4">
      {isEdit && <input type="hidden" name="id" value={defaults!.id} />}

      {!isEdit && (
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
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">Status</span>
          <select name="status" defaultValue={defaults?.status ?? "DRAFT"} className="input">
            <option value="DRAFT">Draft</option>
            <option value="SENT">Sent</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="DECLINED">Rejected</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">Valid until</span>
          <input
            name="validUntil"
            type="date"
            required
            defaultValue={defaults ? toDateTimeLocal(defaults.validUntil).slice(0, 10) : ""}
            className="input"
          />
        </label>
      </div>

      <LineItemsFields initial={defaults?.items ?? []} />

      {state.error && <p className="text-sm text-accent">{state.error}</p>}

      <div>
        <button type="submit" disabled={pending} className="btn">
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create quote"}
        </button>
      </div>
    </form>
  );
}
