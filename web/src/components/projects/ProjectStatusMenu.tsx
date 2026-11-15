"use client";

import { useRouter } from "next/navigation";
import { setProjectStatusAction } from "@/lib/actions/projects";
import { StatusMenu } from "@/components/ui/StatusMenu";
import { PROJECT_STATUS_TONE } from "@/components/projects/ProjectStatusChip";
import { useConfirmDialog } from "@/components/ui/ConfirmDialogProvider";
import { getDictionary, type Locale } from "@/lib/dictionary";
import type { ProjectStatus } from "@/generated/prisma/enums";

const ORDER: ProjectStatus[] = ["INQUIRY", "QUOTE_SENT", "CONFIRMED", "IN_PROGRESS", "TO_INVOICE", "CLOSED", "CANCELLED"];

/** The project's status chip, clickable to change the status in place. */
export function ProjectStatusMenu({ projectId, status, locale }: { projectId: string; status: ProjectStatus; locale: Locale }) {
  const t = getDictionary(locale);
  const router = useRouter();
  const { notify } = useConfirmDialog();

  return (
    <StatusMenu
      value={status}
      label={t.common.changeStatus}
      options={ORDER.map((s) => ({ value: s, label: t.statusProject[s], tone: PROJECT_STATUS_TONE[s] }))}
      onSelect={async (next) => {
        const res = await setProjectStatusAction(projectId, next as ProjectStatus);
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
