import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import localFont from "next/font/local";
import "./globals.css";
import { getCompanySettings } from "@/lib/queries/finance";
import { getAppColors, colorsToCssVars } from "@/lib/theme";
import { getLocale } from "@/lib/i18n";
import { CapacitorBridge } from "@/components/mobile/CapacitorBridge";

// Licensed font (commercial use allowed — see src/fonts/neue-regrade/LICENSE.txt).
// Self-hosted rather than Google Fonts since it isn't published there.
const neueRegrade = localFont({
  src: "../fonts/neue-regrade/NeueRegrade-Variable.ttf",
  variable: "--font-neue-regrade",
  weight: "300 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Event System",
  description: "Internal event-agency system — events, finance, time tracking.",
};

// viewportFit: "cover" is what makes env(safe-area-inset-*) resolve to real
// values instead of 0 — needed both for MobileNav's existing bottom-inset
// padding and MobileTopBar's top-inset padding to actually clear the
// notch/home-indicator when this page is loaded inside the iOS app shell
// (ios-app/) rather than a normal browser tab.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Every route in this app already depends on the session/DB on every
// request (see authz.ts's requireUser()) — there's nothing here that could
// ever be usefully static. Forcing dynamic rendering also stops `next
// build` from trying to prerender /_not-found, which would otherwise run
// this layout's getCompanySettings() DB call at build time — fatal on a
// host like Railway where a volume-backed DATABASE_URL only exists once
// the runtime container starts, not during the build step.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [company, locale] = await Promise.all([getCompanySettings(), getLocale()]);
  const colors = getAppColors(company);

  return (
    <html
      lang={locale}
      className={`${neueRegrade.variable} h-full antialiased`}
      style={colorsToCssVars(colors) as CSSProperties}
    >
      <body className="min-h-full bg-bg text-ink font-sans">
        <CapacitorBridge />
        {children}
      </body>
    </html>
  );
}
