"use client";

import { Menu, MenuAnchor } from "@/components/ui/Menu";

/**
 * "Download PDF" → a small EN/CZ language menu (the PDF route takes ?lang=).
 * Deliberately not a native confirm()/prompt() — this app never uses native
 * dialogs for in-app interaction.
 */
export function DownloadPdfButton({
  pdfUrl,
  className,
  label = "Download PDF",
}: {
  pdfUrl: string;
  className?: string;
  label?: string;
}) {
  return (
    <Menu align="right" width={132} trigger={label} triggerClassName={className}>
      <MenuAnchor href={`${pdfUrl}?lang=cs`}>Čeština</MenuAnchor>
      <MenuAnchor href={`${pdfUrl}?lang=en`}>English</MenuAnchor>
    </Menu>
  );
}
