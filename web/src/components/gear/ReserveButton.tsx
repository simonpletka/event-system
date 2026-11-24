"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { getDictionary, type Locale } from "@/lib/dictionary";
import type { GearTypeOption } from "@/lib/queries/gear";
import type { PickableProject } from "@/components/ProjectPicker";
import { ReservePanel } from "./ReservePanel";

/**
 * A button that opens the reserve panel in a popup. With `queryKey` it also
 * opens when the page's URL carries `?<queryKey>=1` (the Availability header
 * links there), and closing it drops the parameter.
 */
export function ReserveButton({
  label,
  className = "btno",
  locale,
  projects,
  initialProjectId,
  types,
  initialLines,
  today,
  queryKey,
  hideButton = false,
}: {
  label: string;
  className?: string;
  locale: Locale;
  projects: PickableProject[];
  initialProjectId?: string;
  types: GearTypeOption[];
  initialLines: { typeId: string; quantity: number }[];
  today: string;
  queryKey?: string;
  hideButton?: boolean;
}) {
  const dict = getDictionary(locale);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const fromUrl = queryKey ? params.get(queryKey) === "1" : false;
  const [open, setOpen] = useState(false);
  const shown = open || fromUrl;

  function close() {
    setOpen(false);
    if (fromUrl && queryKey) {
      const next = new URLSearchParams(params);
      next.delete(queryKey);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }

  return (
    <>
      {!hideButton && (
        <button type="button" onClick={() => setOpen(true)} className={className}>
          {label}
        </button>
      )}
      {shown && (
        <Modal title={dict.gear.reserveTitle} onClose={close} closeLabel={dict.common.close}>
          <ReservePanel
            title=""
            locale={locale}
            projects={projects}
            initialProjectId={initialProjectId}
            types={types}
            initialLines={initialLines}
            editableLines
            today={today}
            canReserve
          />
        </Modal>
      )}
    </>
  );
}
