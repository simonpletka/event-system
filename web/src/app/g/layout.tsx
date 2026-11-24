import { isTestMode } from "@/lib/data-mode";
import { getLocale, getDictionary } from "@/lib/i18n";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialogProvider";

/**
 * The scan pages (/g/<code>) sit outside the app shell: a QR or NFC scan on a
 * phone lands here, so it's one column, big buttons, no sidebar. Sign-in is
 * checked by the page itself, which sends people to /login?next=… and back.
 */
export default async function ScanLayout({ children }: { children: React.ReactNode }) {
  const [testMode, locale] = await Promise.all([isTestMode(), getLocale()]);
  const t = getDictionary(locale);
  return (
    <ConfirmDialogProvider defaultLabels={t.confirmDialog}>
      <div className="min-h-dvh px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-[560px]">{children}</div>
      </div>
      {testMode && (
        <div
          title={t.auth.testingBadgeHint}
          className="fixed z-50 right-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] pointer-events-none rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
        >
          {t.auth.testingBadge}
        </div>
      )}
    </ConfirmDialogProvider>
  );
}
