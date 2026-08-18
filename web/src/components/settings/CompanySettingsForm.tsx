"use client";

import { useActionState, useState } from "react";
import { updateCompanySettingsAction, type SettingsFormState } from "@/lib/actions/settings";
import { useAresLookup } from "@/hooks/useAresLookup";
import { AddressAutocompleteInput } from "@/components/ui/AddressAutocompleteInput";

const initialState: SettingsFormState = {};

type Company = {
  name: string;
  address: string;
  ico: string;
  dic: string;
  isVatPayer: boolean;
  bankAccount: string;
  defaultDueDays: number;
  accentColor: string;
  logoPath: string | null;
};

const EMPTY: Company = {
  name: "",
  address: "",
  ico: "",
  dic: "",
  isVatPayer: true,
  bankAccount: "",
  defaultDueDays: 14,
  accentColor: "#ec3013",
  logoPath: null,
};

export function CompanySettingsForm({ defaults }: { defaults: Company | null }) {
  const [state, formAction, pending] = useActionState(updateCompanySettingsAction, initialState);
  const initial = defaults ?? EMPTY;
  const [fields, setFields] = useState<Company>(initial);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoInputKey, setLogoInputKey] = useState(0);
  const ares = useAresLookup();

  function set<K extends keyof Company>(key: K, value: Company[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  async function loadFromAres() {
    const company = await ares.lookup(fields.ico);
    if (!company) return;
    setFields((f) => ({ ...f, ico: company.ico, name: company.name, address: company.address, dic: company.dic }));
  }

  return (
    <div className="grid grid-cols-[1fr_300px] gap-5 max-w-3xl">
      <form action={formAction} className="card p-5 flex flex-col gap-3">
        <div className="heading-label">Company details</div>
        <div className="flex gap-1.5">
          <input name="ico" placeholder="IČO" value={fields.ico} onChange={(e) => set("ico", e.target.value)} required className="input flex-1" />
          <button type="button" onClick={loadFromAres} disabled={ares.loading} className="btno whitespace-nowrap">
            {ares.loading ? "Loading…" : "Load from ARES"}
          </button>
        </div>
        {ares.error && <p className="text-[11px] text-warning -mt-1">{ares.error}</p>}
        <input name="name" placeholder="Company name" value={fields.name} onChange={(e) => set("name", e.target.value)} required className="input" />
        <AddressAutocompleteInput
          name="address"
          placeholder="Address"
          value={fields.address}
          onChange={(v) => set("address", v)}
        />
        <div className="flex gap-1.5 items-center">
          <input name="dic" placeholder="DIČ" value={fields.dic} onChange={(e) => set("dic", e.target.value)} className="input flex-1" />
          <label className="flex items-center gap-1.5 text-[11px] whitespace-nowrap">
            <input
              name="isVatPayer"
              type="checkbox"
              checked={fields.isVatPayer}
              onChange={(e) => set("isVatPayer", e.target.checked)}
            />{" "}
            VAT payer
          </label>
        </div>

        <div className="heading-label mt-2">Bank</div>
        <input
          name="bankAccount"
          placeholder="IBAN"
          value={fields.bankAccount}
          onChange={(e) => set("bankAccount", e.target.value)}
          className="input"
        />
        <span className="text-[9px] placeholder-text -mt-1">Used to render the QR payment code on invoice PDFs.</span>

        <div className="heading-label mt-2">Branding</div>
        <div className="flex gap-3 items-start">
          <div className="flex flex-col gap-1.5 flex-1">
            <input
              key={logoInputKey}
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setRemoveLogo(false);
                setLogoPreview(file ? URL.createObjectURL(file) : null);
              }}
              className="input text-[11px]"
            />
            <span className="text-[9px] placeholder-text">
              PNG, JPG or SVG, max 2MB. Used on generated invoice PDFs (SVG shows here but can&apos;t be embedded in the PDF — use PNG/JPG for that).
            </span>
            {fields.logoPath && !removeLogo && (
              <label className="flex items-center gap-1.5 text-[11px]">
                <input
                  name="removeLogo"
                  type="checkbox"
                  checked={removeLogo}
                  onChange={(e) => {
                    setRemoveLogo(e.target.checked);
                    setLogoPreview(null);
                  }}
                />
                Remove current logo
              </label>
            )}
          </div>
          <div className="w-20 h-20 rounded-xl border border-ink/16 flex items-center justify-center shrink-0 overflow-hidden bg-ink/4">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element -- ephemeral blob: preview URL, not a static asset
              <img src={logoPreview} alt="New logo preview" className="max-w-full max-h-full object-contain" />
            ) : fields.logoPath && !removeLogo ? (
              // eslint-disable-next-line @next/next/no-img-element -- authenticated route, not a static asset next/image can optimize
              <img src={`/api/uploads/logo/${fields.logoPath}`} alt="Company logo" className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-[9px] placeholder-text text-center px-1">No logo</span>
            )}
          </div>
        </div>
        <label className="flex items-center gap-1.5 text-[11px]">
          Accent colour
          <input
            type="color"
            value={fields.accentColor}
            onChange={(e) => set("accentColor", e.target.value)}
            className="w-8 h-6 rounded-md border border-ink/30 p-0 bg-transparent"
          />
          <input
            name="accentColor"
            value={fields.accentColor}
            onChange={(e) => set("accentColor", e.target.value)}
            className="input w-24 text-[11px]"
          />
        </label>
        <span className="text-[9px] placeholder-text -mt-1">Used for the total-due figure and rules on invoice PDFs.</span>

        <div className="heading-label mt-2">Numbering</div>
        <div className="flex gap-1.5">
          <div className="input opacity-60 flex-1">Events, quotes &amp; invoices — YY-XXX</div>
        </div>
        <div className="flex gap-1.5 items-center">
          <div className="input opacity-60 flex-1">Reused per event · lowest unused number</div>
          <label className="flex items-center gap-1.5 text-[11px] whitespace-nowrap">
            Due
            <input
              name="defaultDueDays"
              type="number"
              min={1}
              value={fields.defaultDueDays}
              onChange={(e) => set("defaultDueDays", Number(e.target.value) || 1)}
              className="input w-14"
            />
            days
          </label>
        </div>

        {state.error && <p className="text-sm text-warning">{state.error}</p>}
        {state.success && <p className="text-sm">{state.success}</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={pending} className="btn">
            {pending ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={() => {
              setFields(initial);
              setRemoveLogo(false);
              setLogoPreview(null);
              setLogoInputKey((k) => k + 1);
            }}
            className="btno"
          >
            Cancel
          </button>
        </div>
      </form>

      <div className="card p-5 self-start">
        <div className="heading-label mb-2">Connected accounts</div>
        <ConnectedRow label="Google Workspace" note="sign-in + calendar sync" connected={false} />
        <ConnectedRow label="Calendar for milestones" note="milestone export" connected={false} />
        <ConnectedRow label="ARES lookup" note="company auto-fill" connected />
        <p className="text-[10px] placeholder-text mt-3 max-w-xs">
          ARES is a free public registry, so that one&apos;s live. Google Workspace/Calendar need OAuth credentials
          that land in a later phase.
        </p>
      </div>
    </div>
  );
}

function ConnectedRow({ label, note, connected }: { label: string; note: string; connected: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2.5 py-2.5 border-b border-ink/8 last:border-b-0 text-[13px]">
      <div>
        <div>{label}</div>
        <div className="placeholder-text text-[11px] mt-0.5">{note}</div>
      </div>
      <span className={`tag ${connected ? "tag-positive" : "tag-neutral"}`}>{connected ? "Active" : "Not connected"}</span>
    </div>
  );
}
