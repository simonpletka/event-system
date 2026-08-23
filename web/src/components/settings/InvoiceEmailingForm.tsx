"use client";

import { useActionState, useRef } from "react";
import { updateInvoiceEmailingSettingsAction, type SettingsFormState } from "@/lib/actions/settings";
import { EMAIL_TEMPLATE_TOKENS } from "@/lib/email-templates";
import { getDictionary, type Locale } from "@/lib/dictionary";

const initialState: SettingsFormState = {};

type Templates = {
  invoiceEmailSubject: string;
  invoiceEmailBody: string;
  reminderEmailSubject: string;
  reminderEmailBody: string;
};

export function InvoiceEmailingForm({ defaults, locale }: { defaults: Templates; locale: Locale }) {
  const [state, formAction, pending] = useActionState(updateInvoiceEmailingSettingsAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const t = getDictionary(locale).settings.invoiceEmailing;

  // Everything before the "(reminder only)" one applies to both templates.
  const sendTokens = EMAIL_TEMPLATE_TOKENS.filter((tok) => tok !== "daysOverdue")
    .map((tok) => `{{${tok}}}`)
    .join(", ");
  const allTokens = EMAIL_TEMPLATE_TOKENS.map((tok) => `{{${tok}}}`).join(", ");

  return (
    <form ref={formRef} action={formAction} className="card p-5 flex flex-col gap-4 max-w-2xl">
      <div>
        <div className="heading-label !text-[12px]">{t.heading}</div>
        <p className="text-[10px] placeholder-text mt-1 max-w-prose">{t.intro}</p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-sm font-semibold">{t.sendTemplateHeading}</div>
        <span className="text-[9px] placeholder-text">{t.tokensHint(sendTokens)}</span>
        <label className="flex flex-col gap-1">
          <span className="label">{t.subjectLabel}</span>
          <input name="invoiceEmailSubject" defaultValue={defaults.invoiceEmailSubject} required className="input" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">{t.bodyLabel}</span>
          <textarea name="invoiceEmailBody" defaultValue={defaults.invoiceEmailBody} rows={6} required className="input" />
        </label>
      </div>

      <div className="rule-thin" />

      <div className="flex flex-col gap-2">
        <div className="text-sm font-semibold">{t.reminderTemplateHeading}</div>
        <span className="text-[9px] placeholder-text">
          {t.tokensHint(allTokens)} {t.tokensHintReminderExtra}
        </span>
        <label className="flex flex-col gap-1">
          <span className="label">{t.subjectLabel}</span>
          <input name="reminderEmailSubject" defaultValue={defaults.reminderEmailSubject} required className="input" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">{t.bodyLabel}</span>
          <textarea name="reminderEmailBody" defaultValue={defaults.reminderEmailBody} rows={6} required className="input" />
        </label>
      </div>

      <p className="text-[9px] placeholder-text -mt-1">{t.smtpNote}</p>

      {state.error && <p className="text-sm text-warning">{state.error}</p>}
      {state.success && <p className="text-sm">{state.success}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn">
          {pending ? t.saving : t.saveChanges}
        </button>
        <button type="button" onClick={() => formRef.current?.reset()} className="btno">
          {t.cancel}
        </button>
      </div>
    </form>
  );
}
