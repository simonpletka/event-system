"use client";

import { useActionState, useState } from "react";
import { createClientAction, updateClientAction, type ClientFormState } from "@/lib/actions/clients";
import { CancelLink } from "@/components/ui/CancelLink";
import { StructuredAddressInput, type StructuredAddress } from "@/components/ui/StructuredAddressInput";
import { useAresLookup } from "@/hooks/useAresLookup";
import { getDictionary, type Locale } from "@/lib/dictionary";

const initialState: ClientFormState = {};

export type ClientFormDefaults = {
  id?: string;
  name: string;
  street: string;
  city: string;
  postCode: string;
  state: string;
  ico: string;
  dic: string;
  note: string;
  invoicingEmail: string;
};

export function ClientForm({ defaults, locale }: { defaults: ClientFormDefaults; locale: Locale }) {
  const t = getDictionary(locale);
  const isEdit = Boolean(defaults.id);
  const action = isEdit ? updateClientAction : createClientAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [name, setName] = useState(defaults.name);
  const [ico, setIco] = useState(defaults.ico);
  const [dic, setDic] = useState(defaults.dic);
  const [address, setAddress] = useState<StructuredAddress>({
    street: defaults.street,
    city: defaults.city,
    postCode: defaults.postCode,
    state: defaults.state,
  });
  const ares = useAresLookup();
  const tf = t.clients.form;

  async function loadFromAres() {
    const company = await ares.lookup(ico);
    if (!company) return;
    setIco(company.ico);
    setName(company.name);
    setDic(company.dic);
    // ARES only returns one formatted address line — land it in street and
    // leave city/postCode/state for the user (or the autocomplete below) to
    // fill in, same tradeoff CompanySettingsForm makes with its own address field.
    setAddress((a) => ({ ...a, street: company.address }));
  }

  return (
    <form action={formAction} className="card max-w-lg flex flex-col gap-4 p-6">
      {isEdit && <input type="hidden" name="id" value={defaults.id} />}

      <label className="flex flex-col gap-1.5">
        <span className="heading-label">{tf.icoLabel}</span>
        <div className="flex gap-1.5">
          <input name="ico" value={ico} onChange={(e) => setIco(e.target.value)} className="input flex-1" />
          <button type="button" onClick={loadFromAres} disabled={ares.loading} className="btno whitespace-nowrap">
            {ares.loading ? tf.loadingAres : tf.loadFromAres}
          </button>
        </div>
        {ares.error && <span className="text-[11px] text-warning">{ares.error}</span>}
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="heading-label">{tf.companyNameLabel}</span>
        <input name="name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus className="input" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="heading-label">{tf.addressLabel}</span>
        <StructuredAddressInput value={address} onChange={setAddress} t={t.clients.address} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="heading-label">{tf.dicLabel}</span>
        <input name="dic" value={dic} onChange={(e) => setDic(e.target.value)} className="input" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="heading-label">{tf.invoicingEmailLabel}</span>
        <input name="invoicingEmail" type="email" defaultValue={defaults.invoicingEmail} className="input" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="heading-label">{tf.noteLabel}</span>
        <textarea name="note" defaultValue={defaults.note} rows={3} className="input" />
      </label>

      {state.error && <p className="text-sm text-warning">{state.error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn">
          {pending ? tf.saving : isEdit ? tf.saveChanges : tf.createClient}
        </button>
        <CancelLink href={isEdit ? `/clients/${defaults.id}` : "/clients"} label={t.common.cancel} />
      </div>
    </form>
  );
}
