"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Replaces a plain "Download PDF" link with a click-to-reveal EN/CZ choice.
 * Deliberately an inline dropdown, not a native `confirm()`/`prompt()` — this
 * app never uses native dialogs for in-app interaction (see ConfirmDialogProvider).
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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button type="button" onClick={() => setOpen((o) => !o)} className={className ?? "btno"}>
        {label}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-10 border border-ink bg-bg min-w-[9rem] shadow-lg">
          <a
            href={`${pdfUrl}?lang=en`}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-[11px] hover:bg-accent hover:text-bg"
          >
            English
          </a>
          <a
            href={`${pdfUrl}?lang=cs`}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-[11px] border-t border-ink/15 hover:bg-accent hover:text-bg"
          >
            Čeština
          </a>
        </div>
      )}
    </div>
  );
}
