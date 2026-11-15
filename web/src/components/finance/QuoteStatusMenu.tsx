"use client";

import { useRouter } from "next/navigation";
import { setQuoteStatusAction } from "@/lib/actions/finance";
import { StatusMenu } from "@/components/ui/StatusMenu";
import { QUOTE_STATUS_VARIANT } from "@/components/StatusPill";
import { useConfirmDialog } from "@/components/ui/ConfirmDialogProvider";
import { getDictionary, type Locale } from "@/lib/dictionary";
import type { QuoteStatus } from "@/generated/prisma/enums";

const ORDER: QuoteStatus[] = ["DRAFT", "SENT", "ACCEPTED", "DECLINED"];

/** The quote's status chip, clickable to change the status in place. */
export function QuoteStatusMenu({ quoteId, status, locale }: { quoteId: string; status: QuoteStatus; locale: Locale }) {
  const t = getDictionary(locale);
  const router = useRouter();
  const { notify } = useConfirmDialog();

  return (
    <StatusMenu
      value={status}
      label={t.common.changeStatus}
      options={ORDER.map((s) => ({ value: s, label: t.statusQuote[s], tone: QUOTE_STATUS_VARIANT[s] }))}
      onSelect={async (next) => {
        const res = await setQuoteStatusAction(quoteId, next as QuoteStatus);
        if (!res.ok) {
          await notify(res.error ?? "Couldn't change the status.");
          return false;
        }
        router.refresh();
        return true;
      }}
    />
  );
}
