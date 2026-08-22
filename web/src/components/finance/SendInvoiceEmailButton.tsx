"use client";

import { useActionState } from "react";
import type { EmailActionState } from "@/lib/actions/finance";

const initialState: EmailActionState = {};

export function SendInvoiceEmailButton({
  invoiceId,
  action,
  label,
  pendingLabel,
  className,
}: {
  invoiceId: string;
  action: (prev: EmailActionState, formData: FormData) => Promise<EmailActionState>;
  label: string;
  pendingLabel: string;
  className: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <button type="submit" disabled={pending} className={className}>
        {pending ? pendingLabel : label}
      </button>
      {state.error && <p className="text-[10px] text-warning max-w-[220px]">{state.error}</p>}
      {state.success && <p className="text-[10px] placeholder-text">{state.success}</p>}
    </form>
  );
}
