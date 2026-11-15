"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

export function Modal({
  title,
  onClose,
  children,
  closeLabel = "Close",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  closeLabel?: string;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Portalled to <body> so the popup never inherits text styles (uppercase,
  // tracking), clipping or stacking from wherever its trigger button sits.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 backdrop-blur-sm p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="glass-panel rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.55)] w-full max-w-md max-h-[85vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="text-[15px] font-bold">{title}</div>
          <ModalCloseButton onClick={onClose} label={closeLabel} />
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

/** Round ✕ used in every popup header (Modal, RoadmapItemModal). */
export function ModalCloseButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="shrink-0 grid place-items-center w-8 h-8 -mr-1.5 rounded-full text-ink/55 hover:text-ink hover:bg-ink/10 transition-colors"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M5 5l14 14M19 5L5 19" />
      </svg>
    </button>
  );
}
