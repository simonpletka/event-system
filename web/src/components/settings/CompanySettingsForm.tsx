"use client";

import { useActionState } from "react";
import { updateCompanySettingsAction, type SettingsFormState } from "@/lib/actions/settings";

const initialState: SettingsFormState = {};

type Company = {
  name: string;
  address: string;
  ico: string;
  dic: string;
  isVatPayer: boolean;
  bankAccount: string;
  defaultDueDays: number;
} | null;

export function CompanySettingsForm({ defaults }: { defaults: Company }) {
  const [state, formAction, pending] = useActionState(updateCompanySettingsAction, initialState);

  return (
    <div className="grid grid-cols-2 gap-6 max-w-3xl">
      <form action={formAction} className="flex flex-col gap-3">
        <div className="label">Company details</div>
        <div className="flex gap-1.5">
          <input name="ico" placeholder="IČO" defaultValue={defaults?.ico ?? ""} required className="input flex-1" />
          <span className="btno opacity-40 cursor-not-allowed" title="ARES lookup lands in a later phase">
            Load from ARES
          </span>
        </div>
        <input name="name" placeholder="Company name" defaultValue={defaults?.name ?? ""} required className="input" />
        <input name="address" placeholder="Address" defaultValue={defaults?.address ?? ""} className="input" />
        <div className="flex gap-1.5 items-center">
          <input name="dic" placeholder="DIČ" defaultValue={defaults?.dic ?? ""} className="input flex-1" />
          <label className="flex items-center gap-1.5 text-[11px] whitespace-nowrap">
            <input name="isVatPayer" type="checkbox" defaultChecked={defaults?.isVatPayer ?? true} /> VAT payer
          </label>
        </div>

        <div className="label mt-2">Bank</div>
        <input name="bankAccount" placeholder="IBAN" defaultValue={defaults?.bankAccount ?? ""} className="input" />
        <span className="text-[9px] placeholder-text -mt-1">Used to render the QR payment code on invoice PDFs.</span>

        <div className="label mt-2">Numbering</div>
        <div className="flex gap-1.5">
          <div className="input opacity-60 flex-1">Invoices YYYY-NNNN</div>
          <div className="input opacity-60 flex-1">Quotes YYYY-Q##</div>
        </div>
        <div className="flex gap-1.5 items-center">
          <div className="input opacity-60 flex-1">Restarts each year — fixed</div>
          <label className="flex items-center gap-1.5 text-[11px] whitespace-nowrap">
            Due
            <input name="defaultDueDays" type="number" min={1} defaultValue={defaults?.defaultDueDays ?? 14} className="input w-14" />
            days
          </label>
        </div>

        {state.error && <p className="text-sm text-accent">{state.error}</p>}
        {state.success && <p className="text-sm">{state.success}</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={pending} className="btn">
            {pending ? "Saving…" : "Save changes"}
          </button>
          <button type="reset" className="btno">
            Cancel
          </button>
        </div>
      </form>

      <div>
        <div className="label mb-1.5">Connected accounts</div>
        <ConnectedRow label="Google Workspace" note="sign-in + calendar sync" />
        <ConnectedRow label="Calendar for milestones" note="milestone export" />
        <ConnectedRow label="ARES lookup" note="company auto-fill" />
        <p className="text-[10px] placeholder-text mt-3 max-w-xs">
          None of these are wired up yet — they land in a later phase alongside Google OAuth login.
        </p>
      </div>
    </div>
  );
}

function ConnectedRow({ label, note }: { label: string; note: string }) {
  return (
    <div className="grid grid-cols-[1fr_.8fr_.7fr] gap-2.5 py-2 border-b border-ink/10 text-[13px] items-center">
      <div>{label}</div>
      <div className="placeholder-text text-[11px]">{note}</div>
      <span className="pill">Not connected</span>
    </div>
  );
}
