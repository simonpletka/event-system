"use client";

import { useEffect } from "react";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-surface border-2 border-ink w-full max-w-md max-h-[85vh] overflow-y-auto p-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-ink/20 pb-2 mb-3.5">
          <div className="text-sm font-semibold">{title}</div>
          <button type="button" onClick={onClose} aria-label="Close" className="btno px-2 py-1 text-[10px]">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
