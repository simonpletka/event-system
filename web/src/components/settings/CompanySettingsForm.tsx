"use client";

import { useActionState, useState } from "react";
import { updateCompanySettingsAction, type SettingsFormState } from "@/lib/actions/settings";
import { useAresLookup } from "@/hooks/useAresLookup";
import { AddressAutocompleteInput } from "@/components/ui/AddressAutocompleteInput";
import type { Dictionary } from "@/lib/dictionary";

const initialState: SettingsFormState = {};

type Company = {
  name: string;
  address: string;
  ico: string;
  dic: string;
  isVatPayer: boolean;
  bankAccount: string;
  defaultDueDays: number;
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
  logoPath: null,
};

type T = Dictionary["settings"]["company"];

export function CompanySettingsForm({ defaults, t }: { defaults: Company | null; t: T }) {
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
    <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-5 max-w-3xl">
      <form action={formAction} className="card p-5 flex flex-col gap-3">
        <div className="heading-label">{t.companyDetailsHeading}</div>
        <div className="flex gap-1.5">
          <input name="ico" placeholder={t.icoPlaceholder} value={fields.ico} onChange={(e) => set("ico", e.target.value)} required className="input flex-1" />
          <button type="button" onClick={loadFromAres} disabled={ares.loading} className="btno whitespace-nowrap">
            {ares.loading ? t.loadingAres : t.loadFromAres}
          </button>
        </div>
        {ares.error && <p className="text-[11px] text-warning -mt-1">{ares.error}</p>}
        <input name="name" placeholder={t.companyNamePlaceholder} value={fields.name} onChange={(e) => set("name", e.target.value)} required className="input" />
        <AddressAutocompleteInput
          name="address"
          placeholder={t.addressPlaceholder}
          value={fields.address}
          onChange={(v) => set("address", v)}
        />
        <div className="flex gap-1.5 items-center">
          <input name="dic" placeholder={t.dicPlaceholder} value={fields.dic} onChange={(e) => set("dic", e.target.value)} className="input flex-1" />
          <label className="flex items-center gap-1.5 text-[11px] whitespace-nowrap">
            <input
              name="isVatPayer"
              type="checkbox"
              checked={fields.isVatPayer}
              onChange={(e) => set("isVatPayer", e.target.checked)}
            />{" "}
            {t.vatPayerLabel}
          </label>
        </div>

        <div className="heading-label mt-2">{t.bankHeading}</div>
        <input
          name="bankAccount"
          placeholder={t.ibanPlaceholder}
          value={fields.bankAccount}
          onChange={(e) => set("bankAccount", e.target.value)}
          className="input"
        />
        <span className="text-[9px] placeholder-text -mt-1">{t.qrHint}</span>

        <div className="heading-label mt-2">{t.brandingHeading}</div>
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
            <span className="text-[9px] placeholder-text">{t.logoHelper}</span>
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
                {t.removeLogoLabel}
              </label>
            )}
          </div>
          <div className="w-20 h-20 rounded-xl border border-ink/16 flex items-center justify-center shrink-0 overflow-hidden bg-ink/4">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element -- ephemeral blob: preview URL, not a static asset
              <img src={logoPreview} alt={t.newLogoPreviewAlt} className="max-w-full max-h-full object-contain" />
            ) : fields.logoPath && !removeLogo ? (
              // eslint-disable-next-line @next/next/no-img-element -- authenticated route, not a static asset next/image can optimize
              <img src={`/api/uploads/logo/${fields.logoPath}`} alt={t.companyLogoAlt} className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-[9px] placeholder-text text-center px-1">{t.noLogo}</span>
            )}
          </div>
        </div>
        <span className="text-[9px] placeholder-text -mt-1">{t.accentMovedNote}</span>

        <div className="heading-label mt-2">{t.numberingHeading}</div>
        <div className="flex gap-1.5">
          <div className="input opacity-60 flex-1">{t.numberingScheme}</div>
        </div>
        <div className="flex gap-1.5 items-center">
          <div className="input opacity-60 flex-1">{t.numberingNote}</div>
          <label className="flex items-center gap-1.5 text-[11px] whitespace-nowrap">
            {t.dueLabel}
            <input
              name="defaultDueDays"
              type="number"
              min={1}
              value={fields.defaultDueDays}
              onChange={(e) => set("defaultDueDays", Number(e.target.value) || 1)}
              className="input w-14"
            />
            {t.daysLabel}
          </label>
        </div>

        {state.error && <p className="text-sm text-warning">{state.error}</p>}
        {state.success && <p className="text-sm">{state.success}</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={pending} className="btn">
            {pending ? t.saving : t.saveChanges}
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
            {t.cancel}
          </button>
        </div>
      </form>

      <div className="card p-5 self-start">
        <div className="heading-label mb-2">{t.connectedAccountsHeading}</div>
        <ConnectedRow label={t.googleWorkspace} note={t.googleWorkspaceNote} connected={false} activeLabel={t.active} notConnectedLabel={t.notConnected} />
        <ConnectedRow label={t.calendarMilestones} note={t.calendarMilestonesNote} connected={false} activeLabel={t.active} notConnectedLabel={t.notConnected} />
        <ConnectedRow label={t.aresLookup} note={t.aresNote} connected activeLabel={t.active} notConnectedLabel={t.notConnected} />
        <p className="text-[10px] placeholder-text mt-3 max-w-xs">{t.aresExplainer}</p>
      </div>
    </div>
  );
}

function ConnectedRow({
  label,
  note,
  connected,
  activeLabel,
  notConnectedLabel,
}: {
  label: string;
  note: string;
  connected: boolean;
  activeLabel: string;
  notConnectedLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2.5 py-2.5 border-b border-ink/8 last:border-b-0 text-[13px]">
      <div>
        <div>{label}</div>
        <div className="placeholder-text text-[11px] mt-0.5">{note}</div>
      </div>
      <span className={`tag ${connected ? "tag-positive" : "tag-neutral"}`}>{connected ? activeLabel : notConnectedLabel}</span>
    </div>
  );
}
