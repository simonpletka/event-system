import type { Metadata } from "next";
import type { CSSProperties } from "react";
import localFont from "next/font/local";
import "./globals.css";
import { getCompanySettings } from "@/lib/queries/finance";
import { getAppColors, colorsToCssVars } from "@/lib/theme";

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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const company = await getCompanySettings();
  const colors = getAppColors(company);
  const locale = company?.locale === "cs" ? "cs" : "en";

  return (
    <html
      lang={locale}
      className={`${neueRegrade.variable} h-full antialiased`}
      style={colorsToCssVars(colors) as CSSProperties}
    >
      <body className="min-h-full bg-bg text-ink font-sans">{children}</body>
    </html>
  );
}
