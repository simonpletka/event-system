"use client";

import { Menu, MenuAnchor } from "@/components/ui/Menu";
import { DownloadIcon } from "@/components/ui/icons";
import { DEFAULT_PDF_THEME, type PdfTheme } from "@/lib/pdf/theme";

/**
 * "PDF" download → a small EN/CZ language menu (the PDF route takes ?lang=).
 * Picking a language saves the file straight away (?download=1 + the
 * `download` attribute), with no new tab. `theme` picks the light (default)
 * or dark PDF; the detail pages pass their preview's theme, lists keep light.
 * Default trigger is the `.btno` outline pill, matching the other header
 * buttons; `subtle` gives a borderless trigger for use inside a dense table row.
 */
export function DownloadPdfButton({
  pdfUrl,
  label = "PDF",
  subtle,
  theme = DEFAULT_PDF_THEME,
}: {
  pdfUrl: string;
  label?: string;
  subtle?: boolean;
  theme?: PdfTheme;
}) {
  return (
    <Menu
      align="right"
      width={132}
      icon={<DownloadIcon size={subtle ? 12 : 13} />}
      value={label}
      triggerClassName={
        subtle
          ? "inline-flex items-center gap-1 text-[10px] tracking-[0.1em] uppercase text-ink/45 hover:text-accent transition-colors"
          : "btno inline-flex items-center gap-1.5"
      }
    >
      <MenuAnchor href={`${pdfUrl}?lang=cs&download=1&theme=${theme}`} download>
        Čeština
      </MenuAnchor>
      <MenuAnchor href={`${pdfUrl}?lang=en&download=1&theme=${theme}`} download>
        English
      </MenuAnchor>
    </Menu>
  );
}
