"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { getDictionary } from "@/lib/dictionary";
import { ReportIssueForm } from "./ReportIssueForm";

/** "Report issue" that opens the report form in a popup. */
export function ReportIssueButton({
  label,
  className = "btno",
  ...form
}: { label?: string; className?: string } & Omit<React.ComponentProps<typeof ReportIssueForm>, "onDone">) {
  const dict = getDictionary(form.locale);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label ?? dict.gear.reportIssue}
      </button>
      {open && (
        <Modal title={dict.gear.reportTitle} onClose={() => setOpen(false)} closeLabel={dict.common.close}>
          <ReportIssueForm {...form} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
