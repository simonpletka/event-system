"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/dictionary";
import { reassignGearReservationAction } from "@/lib/actions/gear-units";

/** One click moves the booking to a free unit of the same type, or says none is free. Never automatic. */
export function ReassignButton({ reservationId, locale }: { reservationId: string; locale: Locale }) {
  const t = getDictionary(locale).gear;
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await reassignGearReservationAction(reservationId);
            setMessage(r.ok ? { ok: true, text: t.reassigned(r.toNumber) } : { ok: false, text: r.error === "noneFree" ? t.reassignNone : t.invalid });
            if (r.ok) router.refresh();
          })
        }
        className="btno !text-[10px] min-h-[36px]"
      >
        {pending ? t.reassigning : t.reassign}
      </button>
      {message && (
        <span role="status" className={`text-[12.5px] ${message.ok ? "text-positive" : "text-warning"}`}>
          {message.text}
        </span>
      )}
    </span>
  );
}
