"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type ConfirmOptions = { title?: string; confirmLabel?: string; cancelLabel?: string };
type NotifyOptions = { title?: string; dismissLabel?: string };

type DialogState =
  | { mode: "confirm"; message: string; options: ConfirmOptions; resolve: (value: boolean) => void }
  | { mode: "notify"; message: string; options: NotifyOptions; resolve: () => void };

type ConfirmContextValue = {
  /** In-app replacement for window.confirm() — resolves true/false, styled to match the app instead of the browser. */
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  /** In-app replacement for window.alert() — a single acknowledgement button, used e.g. to explain why a delete was blocked. */
  notify: (message: string, options?: NotifyOptions) => Promise<void>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirmDialog() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirmDialog must be used within ConfirmDialogProvider");
  return ctx;
}

export function ConfirmDialogProvider({
  children,
  defaultLabels = { cancel: "Cancel", confirm: "Confirm", ok: "OK" },
}: {
  children: React.ReactNode;
  defaultLabels?: { cancel: string; confirm: string; ok: string };
}) {
  const [state, setState] = useState<DialogState | null>(null);

  const confirm = useCallback((message: string, options: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      setState({ mode: "confirm", message, options, resolve });
    });
  }, []);

  const notify = useCallback((message: string, options: NotifyOptions = {}) => {
    return new Promise<void>((resolve) => {
      setState({ mode: "notify", message, options, resolve });
    });
  }, []);

  const close = useCallback(
    (result: boolean) => {
      if (!state) return;
      if (state.mode === "confirm") state.resolve(result);
      else state.resolve();
      setState(null);
    },
    [state]
  );

  useEffect(() => {
    if (!state) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state, close]);

  return (
    <ConfirmContext.Provider value={{ confirm, notify }}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 backdrop-blur-sm p-4"
          role="presentation"
          onClick={() => close(false)}
        >
          <div
            className="glass-panel rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.55)] w-full max-w-sm p-6"
            role={state.mode === "confirm" ? "alertdialog" : "dialog"}
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            {state.options.title && <div className="text-[15px] font-bold mb-2">{state.options.title}</div>}
            <p className="text-[14px] leading-relaxed text-ink/85">{state.message}</p>
            {state.mode === "confirm" ? (
              <div className="flex gap-2.5 mt-6">
                <button type="button" className="btn flex-1" autoFocus onClick={() => close(false)}>
                  {state.options.cancelLabel ?? defaultLabels.cancel}
                </button>
                <button type="button" className="btno flex-1" onClick={() => close(true)}>
                  {state.options.confirmLabel ?? defaultLabels.confirm}
                </button>
              </div>
            ) : (
              <div className="flex justify-end mt-6">
                <button type="button" className="btn" autoFocus onClick={() => close(false)}>
                  {state.options.dismissLabel ?? defaultLabels.ok}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
