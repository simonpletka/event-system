"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { getDictionary, type Locale } from "@/lib/dictionary";
import type { GearTypeOption } from "@/lib/queries/gear";
import type { PickableProject } from "@/components/ProjectPicker";
import { ReservePanel } from "./ReservePanel";

/** "Edit" on a reservation card: the reserve panel, filled with that reservation. */
export function EditBatchButton({
  batch,
  types,
  projects,
  today,
  locale,
}: {
  batch: {
    batchId: string;
    startDate: string;
    endDate: string;
    note: string;
    project: { id: string; title: string; companyName: string } | null;
    lines: { typeId: string; numbers: number[] }[];
  };
  types: GearTypeOption[];
  projects: PickableProject[];
  today: string;
  locale: Locale;
}) {
  const dict = getDictionary(locale);
  const [open, setOpen] = useState(false);
  // Its project may be closed, so not in the reservable list; keep it choosable.
  const pickable =
    batch.project && !projects.some((p) => p.id === batch.project!.id)
      ? [{ id: batch.project.id, title: batch.project.title, companyName: batch.project.companyName }, ...projects]
      : projects;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btno">
        {dict.gear.editReservation}
      </button>
      {open && (
        <Modal title={dict.gear.editReservationTitle} onClose={() => setOpen(false)} closeLabel={dict.common.close}>
          <ReservePanel
            title=""
            locale={locale}
            projects={pickable}
            types={types}
            initialLines={batch.lines.map((l) => ({ typeId: l.typeId, quantity: l.numbers.length }))}
            editableLines
            today={today}
            canReserve
            editBatch={{ batchId: batch.batchId, projectId: batch.project?.id ?? null, note: batch.note, startDate: batch.startDate, endDate: batch.endDate }}
            onSaved={() => setOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}
